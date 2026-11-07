"""Propuesta de planeación: unidades y temas ligados a DBA (SPEC-0014, ADR-0013).

Una llamada al LLM por periodo. El reparto de los DBA entre periodos llega ya hecho desde la web
(determinista, ADR-0013): el modelo solo agrupa y titula, y el validador exige que cada DBA que el
periodo "debe cubrir" quede en al menos un tema. Los códigos que no están en el periodo se quitan
sin pedir reparación (RN-01) y se cuentan en `dropped_codes`.
"""

import json
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..config import ENGINE_DIR
from ..providers.llm import DATA_END, DATA_START, LLM, Message
from .pipeline import looks_spanish, norm, run_structured

PLANNING_PROMPT_VERSION = "planning.v1"
SYSTEM_PROMPT = (ENGINE_DIR / "prompts" / f"{PLANNING_PROMPT_VERSION}.md").read_text(
    encoding="utf8"
)

TITLE_MIN, TITLE_MAX = 3, 80
DESCRIPTION_MAX = 200
CODES_PER_TOPIC = 3


class DbaRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(max_length=60)
    statement: str = Field(max_length=1500)
    evidences: list[str] = Field(default_factory=list, max_length=12)


class ExistingUnit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(max_length=150)
    topics: list[str] = Field(default_factory=list, max_length=40)


class PeriodTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    number: int = Field(ge=1, le=6)
    name: str = Field(max_length=60)
    dbaCodes: list[str] = Field(default_factory=list, max_length=60)  # noqa: N815
    mustCover: list[str] = Field(default_factory=list, max_length=60)  # noqa: N815
    existing: list[ExistingUnit] = Field(default_factory=list, max_length=30)


class UnitTarget(BaseModel):
    """Proponer temas para una unidad que ya existe (CA-0014-06)."""

    model_config = ConfigDict(extra="forbid")
    title: str = Field(max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    topics: list[str] = Field(default_factory=list, max_length=40)


class PlanningRequest(BaseModel):
    """`extra="forbid"`: no hay campo donde quepan datos personales (SPEC-0014 §9)."""

    model_config = ConfigDict(extra="forbid")
    subject: str = Field(max_length=80)
    grade: str = Field(max_length=20)
    dba: list[DbaRef] = Field(max_length=60)
    periods: list[PeriodTarget] = Field(min_length=1, max_length=6)
    unit: UnitTarget | None = None
    # Títulos que el docente ya tiene en la revisión ("otra propuesta"): no repetirlos.
    avoid: list[str] = Field(default_factory=list, max_length=120)
    unitsMin: int = Field(default=2, ge=1, le=6)  # noqa: N815
    unitsMax: int = Field(default=4, ge=1, le=6)  # noqa: N815
    topicsMin: int = Field(default=2, ge=1, le=6)  # noqa: N815
    topicsMax: int = Field(default=4, ge=1, le=6)  # noqa: N815

    @model_validator(mode="after")
    def _ranges(self) -> "PlanningRequest":
        if self.unitsMin > self.unitsMax or self.topicsMin > self.topicsMax:
            raise ValueError("min no puede ser mayor que max")
        if self.unit is not None and len(self.periods) != 1:
            raise ValueError("una unidad se propone dentro de un solo periodo")
        numbers = [p.number for p in self.periods]
        if len(set(numbers)) != len(numbers):
            raise ValueError("periodos repetidos")
        known = {d.code for d in self.dba}
        for p in self.periods:
            if not set(p.dbaCodes) <= known or not set(p.mustCover) <= set(p.dbaCodes):
                raise ValueError("los DBA del periodo deben estar en la lista de DBA")
        return self


class TopicOut(BaseModel):
    title: str
    description: str = ""
    dbaCodes: list[str] = Field(default_factory=list)  # noqa: N815


class UnitOut(BaseModel):
    title: str
    topics: list[TopicOut]


class PeriodOut(BaseModel):
    units: list[UnitOut]


class PeriodResult(BaseModel):
    number: int
    units: list[UnitOut]


@dataclass(frozen=True)
class PlanningResult:
    periods: list[PeriodResult]
    provider: str
    model: str
    attempts: int
    latency_ms: int
    tokens: int
    dropped_codes: int


def _units_range(request: PlanningRequest) -> tuple[int, int]:
    return (1, 1) if request.unit else (request.unitsMin, request.unitsMax)


def build_messages(
    request: PlanningRequest, period: PeriodTarget, taken: list[str]
) -> list[Message]:
    """`taken`: títulos ya usados en periodos anteriores de esta misma propuesta."""
    allowed = set(period.dbaCodes)
    units_min, units_max = _units_range(request)
    data = {
        "tarea": "planeacion",
        "asignatura": request.subject,
        "grado": request.grade,
        "periodo": {"numero": period.number, "nombre": period.name},
        "dba": [
            {"codigo": d.code, "enunciado": d.statement, "evidencias": d.evidences}
            for d in request.dba
            if d.code in allowed
        ],
        "debeCubrir": period.mustCover,
        "existentes": [{"unidad": u.title, "temas": u.topics} for u in period.existing],
        "titulosUsados": taken,
        "unidad": (
            {
                "titulo": request.unit.title,
                "descripcion": request.unit.description,
                "temas": request.unit.topics,
            }
            if request.unit
            else None
        ),
        "unidades": {"min": units_min, "max": units_max},
        "temasPorUnidad": {"min": request.topicsMin, "max": request.topicsMax},
    }
    if request.unit:
        ask = (
            f"Propón entre {request.topicsMin} y {request.topicsMax} temas nuevos para la unidad "
            f"«{request.unit.title}». Devuelve una sola unidad con ese título."
        )
    else:
        ask = (
            f"Propón entre {units_min} y {units_max} unidades para el periodo {period.number}, "
            f"cada una con {request.topicsMin} a {request.topicsMax} temas."
        )
    user = (
        f"{ask}\n{DATA_START}\n{json.dumps(data, ensure_ascii=False)}\n{DATA_END}\n"
        "Responde solo con el JSON pedido."
    )
    return [Message("system", SYSTEM_PROMPT), Message("user", user)]


def _existing_titles(request: PlanningRequest, period: PeriodTarget) -> tuple[set[str], set[str]]:
    units = {norm(u.title) for u in period.existing}
    topics = {norm(t) for u in period.existing for t in u.topics}
    if request.unit:
        topics |= {norm(t) for t in request.unit.topics}
    return units, topics


def validate_period(
    out: PeriodOut, request: PlanningRequest, period: PeriodTarget, taken: list[str]
) -> list[str]:
    """Validador pedagógico (RN-03, RN-04, RN-05). Devuelve los problemas encontrados."""
    errors: list[str] = []
    units_min, units_max = _units_range(request)
    if not units_min <= len(out.units) <= units_max:
        errors.append(f"Se pidieron {units_min} a {units_max} unidades y llegaron {len(out.units)}")
    existing_units, existing_topics = _existing_titles(request, period)
    used = {norm(t) for t in taken}
    seen: set[str] = set()
    allowed = set(period.dbaCodes)
    covered: set[str] = set()
    text: list[str] = []

    def check_title(label: str, title: str, existing: set[str]) -> None:
        key = norm(title)
        if not TITLE_MIN <= len(title.strip()) <= TITLE_MAX:
            errors.append(
                f"{label}: el título debe tener entre {TITLE_MIN} y {TITLE_MAX} caracteres"
            )
        if key in existing or key in used:
            errors.append(f"{label}: repite un título que ya existe («{title.strip()}»)")
        if key in seen:
            errors.append(f"{label}: título repetido en la propuesta («{title.strip()}»)")
        seen.add(key)

    for i, unit in enumerate(out.units, start=1):
        if not request.unit:
            check_title(f"Unidad {i}", unit.title, existing_units)
        if not request.topicsMin <= len(unit.topics) <= request.topicsMax:
            errors.append(
                f"Unidad {i}: se pidieron {request.topicsMin} a {request.topicsMax} temas "
                f"y llegaron {len(unit.topics)}"
            )
        for j, topic in enumerate(unit.topics, start=1):
            label = f"Unidad {i}, tema {j}"
            check_title(label, topic.title, existing_topics)
            if len(topic.description) > DESCRIPTION_MAX:
                errors.append(f"{label}: la descripción pasa de {DESCRIPTION_MAX} caracteres")
            valid = [c for c in topic.dbaCodes if c in allowed]
            if allowed and not valid:
                errors.append(f"{label}: debe citar al menos un DBA de los datos")
            covered |= set(valid)
            text += [topic.title, topic.description]
    missing = [c for c in period.mustCover if c not in covered]
    if missing:
        errors.append(f"Faltan temas para estos DBA: {', '.join(missing)}")
    if out.units and not looks_spanish(" ".join(text)):
        errors.append("La propuesta no parece estar en español")
    return errors


def _clean(out: PeriodOut, request: PlanningRequest, period: PeriodTarget) -> tuple[list, int]:
    """Quita códigos ajenos al periodo (RN-01), repetidos y de más; recorta espacios."""
    allowed = set(period.dbaCodes)
    dropped = 0
    units = []
    for unit in out.units:
        topics = []
        for topic in unit.topics:
            codes = list(dict.fromkeys(c for c in topic.dbaCodes if c in allowed))
            dropped += len([c for c in topic.dbaCodes if c not in allowed])
            topics.append(
                TopicOut(
                    title=topic.title.strip(),
                    description=topic.description.strip(),
                    dbaCodes=codes[:CODES_PER_TOPIC],
                )
            )
        title = request.unit.title if request.unit else unit.title.strip()
        units.append(UnitOut(title=title, topics=topics))
    return units, dropped


def propose_planning(llm: LLM, request: PlanningRequest) -> PlanningResult:
    """Una llamada por periodo, en orden; cualquier periodo inválido tras reparar falla todo."""
    taken: list[str] = [t[:150] for t in request.avoid]
    periods: list[PeriodResult] = []
    provider = model = ""
    attempts = latency = tokens = dropped = 0
    for period in request.periods:
        snapshot = list(taken)
        result = run_structured(
            llm,
            build_messages(request, period, snapshot),
            PeriodOut,
            lambda out, p=period, t=snapshot: validate_period(out, request, p, t),
            max_tokens=400 + 120 * request.topicsMax * _units_range(request)[1],
        )
        units, period_dropped = _clean(result.value, request, period)
        periods.append(PeriodResult(number=period.number, units=units))
        taken += [u.title for u in units] + [t.title for u in units for t in u.topics]
        provider, model = result.provider, result.model
        attempts += result.attempts
        latency += result.latency_ms
        tokens += result.tokens
        dropped += period_dropped
    return PlanningResult(
        periods=periods,
        provider=provider,
        model=model,
        attempts=attempts,
        latency_ms=latency,
        tokens=tokens,
        dropped_codes=dropped,
    )
