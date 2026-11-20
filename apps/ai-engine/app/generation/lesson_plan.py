"""Plan de aula: secuencia didáctica de un tema con evaluación y rúbrica (SPEC-0024, ADR-0019).

Contrato `generation-lesson-plan.v1`. Usa el mismo contexto del taller (`ResourceContext`, sin datos
personales). La IA no escribe rangos ni notas de la rúbrica: los pone el producto con la escala del
colegio.
"""

from dataclasses import replace
from typing import Annotated

from pydantic import BaseModel, Field

from ..providers.llm import LLM, Message
from .pipeline import StructuredResult, looks_spanish, norm, run_structured
from .resources import (
    BACKGROUND_MAX_WAIT_S,
    ResourceContext,
    _code_errors,
    _context_data,
    _messages,
    _prompt,
)

LESSON_PLAN_PROMPT_VERSION = "lesson_plan.v1"
LESSON_PLAN_PROMPT = _prompt(LESSON_PLAN_PROMPT_VERSION)
LEVEL_KEYS = ("superior", "high", "basic", "low")

Short = Annotated[str, Field(max_length=200)]
Long = Annotated[str, Field(max_length=2000)]


class LessonPlanRequest(ResourceContext):
    sessions: int = Field(ge=1, le=6)
    minutesPerSession: int = Field(ge=30, le=120)  # noqa: N815


class Session(BaseModel):
    number: int
    title: Short
    start: Long
    startMinutes: int  # noqa: N815
    development: Long
    developmentMinutes: int  # noqa: N815
    closure: Long
    closureMinutes: int  # noqa: N815
    resources: list[Short] = Field(default_factory=list, max_length=8)
    dbaCodes: list[str] = Field(default_factory=list, max_length=6)  # noqa: N815


class Evaluation(BaseModel):
    evidence: Long
    instruments: list[Short] = Field(default_factory=list, max_length=6)


class RubricRow(BaseModel):
    criterion: Short
    superior: Annotated[str, Field(max_length=400)]
    high: Annotated[str, Field(max_length=400)]
    basic: Annotated[str, Field(max_length=400)]
    low: Annotated[str, Field(max_length=400)]


class LessonPlanOut(BaseModel):
    title: Short
    purpose: Long
    sessions: list[Session] = Field(max_length=10)
    evaluation: Evaluation
    rubric: list[RubricRow] = Field(max_length=8)
    diversity: Long = ""


def build_lesson_plan_messages(request: LessonPlanRequest) -> list[Message]:
    data = {
        "tarea": "plan_de_aula",
        **_context_data(request),
        "cantidadSesiones": request.sessions,
        "minutosPorSesion": request.minutesPerSession,
    }
    return _messages(
        LESSON_PLAN_PROMPT,
        f"Elabora un plan de aula de exactamente {request.sessions} sesiones de "
        f"{request.minutesPerSession} minutos.",
        data,
    )


def _length(errors: list[str], label: str, text: str, low: int, high: int) -> None:
    if not low <= len(text.strip()) <= high:
        errors.append(f"{label}: debe tener entre {low} y {high} caracteres")


def validate_lesson_plan(out: LessonPlanOut, request: LessonPlanRequest) -> list[str]:
    """RN-02 y RN-03: sesiones completas, minutos que suman, rúbrica en progresión y DBA reales."""
    errors: list[str] = []
    allowed = {d.code for d in request.dba}
    _length(errors, "'title'", out.title, 3, 150)
    _length(errors, "'purpose'", out.purpose, 10, 600)
    if len(out.sessions) != request.sessions:
        errors.append(f"Se pidieron {request.sessions} sesiones y llegaron {len(out.sessions)}")
    for i, s in enumerate(out.sessions, start=1):
        label = f"Sesión {i}"
        if s.number != i:
            errors.append(f"{label}: 'number' debe ser {i}")
        _length(errors, f"{label}: el título", s.title, 3, 150)
        for key, name in (
            ("start", "inicio"),
            ("development", "desarrollo"),
            ("closure", "cierre"),
        ):
            _length(errors, f"{label}: el {name}", getattr(s, key), 20, 1500)
        minutes = [s.startMinutes, s.developmentMinutes, s.closureMinutes]
        if any(m <= 0 for m in minutes):
            errors.append(f"{label}: cada momento necesita minutos")
        elif abs(sum(minutes) - request.minutesPerSession) > request.minutesPerSession * 0.1:
            errors.append(
                f"{label}: los momentos suman {sum(minutes)} minutos y deben sumar "
                f"{request.minutesPerSession}"
            )
        if len(s.resources) > 6:
            errors.append(f"{label}: máximo 6 recursos")
        errors += _code_errors(label, s.dbaCodes, allowed)
    _length(errors, "'evaluation.evidence'", out.evaluation.evidence, 10, 800)
    if not 1 <= len([x for x in out.evaluation.instruments if x.strip()]) <= 4:
        errors.append("'evaluation.instruments' debe traer de 1 a 4 instrumentos")
    if not 2 <= len(out.rubric) <= 5:
        errors.append("La rúbrica debe tener de 2 a 5 criterios")
    for i, row in enumerate(out.rubric, start=1):
        label = f"Criterio {i} de la rúbrica"
        _length(errors, f"{label}: 'criterion'", row.criterion, 3, 150)
        levels = [getattr(row, k).strip() for k in LEVEL_KEYS]
        if any(not 10 <= len(x) <= 300 for x in levels):
            errors.append(f"{label}: cada desempeño necesita un descriptor de 10 a 300 caracteres")
        if len({norm(x) for x in levels}) != len(levels):
            errors.append(f"{label}: los cuatro desempeños deben ser distintos")
    text = " ".join([out.purpose, *(s.development for s in out.sessions)])
    if not looks_spanish(text):
        errors.append("El plan no parece estar en español")
    return errors


def generate_lesson_plan(llm: LLM, request: LessonPlanRequest) -> StructuredResult[LessonPlanOut]:
    result = run_structured(
        llm,
        build_lesson_plan_messages(request),
        LessonPlanOut,
        lambda out: validate_lesson_plan(out, request),
        max_tokens=900 + 650 * request.sessions,
        max_wait_s=BACKGROUND_MAX_WAIT_S,
    )
    plan = result.value
    clean = plan.model_copy(
        update={
            "title": plan.title.strip(),
            "purpose": plan.purpose.strip(),
            "diversity": plan.diversity.strip(),
            "sessions": [
                s.model_copy(
                    update={
                        "resources": [r.strip() for r in s.resources if r.strip()],
                        "dbaCodes": list(dict.fromkeys(s.dbaCodes)),
                    }
                )
                for s in plan.sessions
            ],
            "evaluation": Evaluation(
                evidence=plan.evaluation.evidence.strip(),
                instruments=[x.strip() for x in plan.evaluation.instruments if x.strip()],
            ),
        }
    )
    return replace(result, value=clean)
