"""Generación de exámenes por secciones (SPEC-0011).

El examen se genera sección por sección (RN-10): cada llamada al modelo es corta, cabe en el límite
por minuto de Groq y se valida y repara por su cuenta. Antes de llamar al modelo, el motor reparte
los temas y los niveles cognitivos entre las secciones, de modo que la unión cumpla el blueprint:
al menos una pregunta por tema (RN-03) y la distribución cognitiva con ±1 por nivel.
"""

from dataclasses import dataclass, replace
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..providers.llm import LLM, Message
from .objectives import DbaRef
from .pipeline import StructuredResult, looks_spanish, norm, run_structured
from .resources import (
    BACKGROUND_MAX_WAIT_S,
    DIFFICULTY_LABELS,
    LEVELS,
    Difficulty,
    Level,
    QuizQuestion,
    _check_distribution,
    _clean_question,
    _messages,
    _prompt,
    question_errors,
    target_counts,
)

EXAM_PROMPT_VERSION = "exam.v1"
EXAM_ITEM_PROMPT_VERSION = "exam_item.v1"
EXAM_PROMPT = _prompt(EXAM_PROMPT_VERSION)
EXAM_ITEM_PROMPT = _prompt(EXAM_ITEM_PROMPT_VERSION)

ExamQuestionType = Literal["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "MATCHING", "OPEN"]
# RN-09: máximo de preguntas por sección según el tipo (en emparejamiento, bloques de pares).
PER_SECTION = {
    "MULTIPLE_CHOICE": 20,
    "TRUE_FALSE": 20,
    "SHORT_ANSWER": 20,
    "MATCHING": 2,
    "OPEN": 5,
}
TYPE_LABELS = {
    "MULTIPLE_CHOICE": "selección múltiple con única respuesta",
    "TRUE_FALSE": "verdadero o falso",
    "SHORT_ANSWER": "respuesta corta",
    "MATCHING": "emparejamiento",
    "OPEN": "pregunta abierta",
}
MIN_QUESTIONS, MAX_QUESTIONS = 10, 40
PAIRS_MIN, PAIRS_MAX, MAX_DISTRACTORS = 4, 8, 2
CRITERIA_MIN, CRITERIA_MAX = 1, 4

Text = Annotated[str, Field(max_length=500)]


def _one_decimal(value: float) -> bool:
    return abs(round(value * 10) - value * 10) < 1e-6


class ExamTopic(BaseModel):
    """Tema del examen. `key` (T1, T2…) es lo que el modelo cita; nunca un id de la base."""

    model_config = ConfigDict(extra="forbid")
    key: str = Field(pattern=r"^T([1-9]|1[0-2])$")
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class ExamSectionSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    questionType: ExamQuestionType  # noqa: N815
    questionCount: int = Field(ge=1, le=20)  # noqa: N815
    pointsPerQuestion: float = Field(gt=0, le=100)  # noqa: N815
    instructions: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def _valid(self):
        if self.questionCount > PER_SECTION[self.questionType]:
            raise ValueError(f"{self.questionType}: máximo {PER_SECTION[self.questionType]}")
        if not _one_decimal(self.pointsPerQuestion):
            raise ValueError("Los puntos admiten máximo un decimal")
        return self


class ExamRequest(BaseModel):
    """Contrato `generation-exam.v1`. `extra="forbid"`: no caben datos personales (RN-08)."""

    model_config = ConfigDict(extra="forbid")
    subject: str = Field(max_length=80)
    grade: str = Field(max_length=20)
    topics: list[ExamTopic] = Field(min_length=1, max_length=12)
    objectives: list[Text] = Field(default_factory=list, max_length=15)
    dba: list[DbaRef] = Field(default_factory=list, max_length=40)
    difficulty: Difficulty = "INTERMEDIATE"
    notes: str | None = Field(default=None, max_length=500)
    preferences: list[Text] = Field(default_factory=list, max_length=5)
    durationMinutes: int = Field(ge=30, le=240)  # noqa: N815
    sections: list[ExamSectionSpec] = Field(min_length=2, max_length=5)
    cognitiveDistribution: dict[Level, int]  # noqa: N815

    @model_validator(mode="after")
    def _valid(self):
        _check_distribution(self.cognitiveDistribution)
        total = sum(s.questionCount for s in self.sections)
        if not MIN_QUESTIONS <= total <= MAX_QUESTIONS:
            raise ValueError(f"El examen debe tener entre {MIN_QUESTIONS} y {MAX_QUESTIONS}")
        keys = [t.key for t in self.topics]
        if len(set(keys)) != len(keys):
            raise ValueError("Temas con la misma clave")
        if len(self.topics) > total:
            raise ValueError("Hay más temas que preguntas")
        levels = sum(1 for v in self.cognitiveDistribution.values() if v > 0)
        if levels > total:
            raise ValueError("Hay más niveles cognitivos que preguntas")
        return self


class Pair(BaseModel):
    model_config = ConfigDict(extra="forbid")
    left: str = Field(max_length=300)
    right: str = Field(max_length=300)


class Criterion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(max_length=300)
    points: float


class ExamQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: ExamQuestionType
    stem: str = Field(max_length=1000)
    options: list[str] = Field(default_factory=list, max_length=6)
    answer: str = Field(default="", max_length=1500)
    explanation: str = Field(default="", max_length=1000)
    pairs: list[Pair] = Field(default_factory=list, max_length=10)
    distractors: list[Annotated[str, Field(max_length=300)]] = Field(
        default_factory=list, max_length=4
    )
    criteria: list[Criterion] = Field(default_factory=list, max_length=6)
    topic: str = Field(max_length=4)
    cognitiveLevel: Level  # noqa: N815
    dbaCodes: list[str] = Field(default_factory=list, max_length=6)  # noqa: N815


class SectionOut(BaseModel):
    questions: list[ExamQuestion]


class ExamSectionResult(BaseModel):
    """Sección generada: las preguntas llevan los puntos del blueprint (RN-06)."""

    questionType: ExamQuestionType  # noqa: N815
    pointsPerQuestion: float  # noqa: N815
    questions: list[ExamQuestion]


class ExamOut(BaseModel):
    sections: list[ExamSectionResult]


class ExamItemRequest(BaseModel):
    """Regenerar una pregunta del examen (`generation-item-regenerate`, versión para examen)."""

    model_config = ConfigDict(extra="forbid")
    subject: str = Field(max_length=80)
    grade: str = Field(max_length=20)
    topics: list[ExamTopic] = Field(min_length=1, max_length=12)
    objectives: list[Text] = Field(default_factory=list, max_length=15)
    dba: list[DbaRef] = Field(default_factory=list, max_length=40)
    difficulty: Difficulty = "INTERMEDIATE"
    notes: str | None = Field(default=None, max_length=500)
    preferences: list[Text] = Field(default_factory=list, max_length=5)
    current: ExamQuestion
    points: float = Field(gt=0, le=100)
    instruction: str = Field(min_length=3, max_length=300)
    otherItems: list[Annotated[str, Field(max_length=1000)]] = Field(  # noqa: N815
        default_factory=list, max_length=40
    )

    @model_validator(mode="after")
    def _valid(self):
        if self.current.topic not in {t.key for t in self.topics}:
            raise ValueError("El tema de la pregunta actual no está en `topics`")
        return self


class ExamItemOut(BaseModel):
    item: ExamQuestion


@dataclass(frozen=True)
class ExamResult:
    value: ExamOut
    provider: str
    model: str
    calls: list[StructuredResult[SectionOut]]

    @property
    def attempts(self) -> int:
        return sum(c.attempts for c in self.calls)

    @property
    def latency_ms(self) -> int:
        return sum(c.latency_ms for c in self.calls)

    @property
    def tokens(self) -> int:
        return sum(c.tokens for c in self.calls)


# --- Plan por secciones ------------------------------------------------------------------------


@dataclass(frozen=True)
class SectionPlan:
    spec: ExamSectionSpec
    levels: dict[str, int]
    """Niveles que esta sección debe cubrir (suman `questionCount`)."""
    topics: list[str]
    """Temas que deben tener al menos una pregunta en esta sección."""


def plan_sections(request: ExamRequest) -> list[SectionPlan]:
    """Reparte niveles y temas entre las secciones.

    Los niveles van de menor a mayor exigencia a lo largo del examen (las primeras secciones, más
    cortas de responder, recuerdan y comprenden; las abiertas analizan o evalúan). Los temas se
    asignan en rueda sobre las posiciones de las preguntas: con tantos o menos temas que
    preguntas, cada tema queda con al menos una (RN-03).
    """
    total = sum(s.questionCount for s in request.sections)
    targets = target_counts(request.cognitiveDistribution, total)
    expanded = [level for level in LEVELS for _ in range(targets.get(level, 0))]
    keys = [t.key for t in request.topics]
    plans, start = [], 0
    for spec in request.sections:
        slots = range(start, start + spec.questionCount)
        levels: dict[str, int] = {}
        for i in slots:
            levels[expanded[i]] = levels.get(expanded[i], 0) + 1
        topics = list(dict.fromkeys(keys[i % len(keys)] for i in slots))
        plans.append(SectionPlan(spec=spec, levels=levels, topics=topics))
        start += spec.questionCount
    return plans


# --- Mensajes ----------------------------------------------------------------------------------


def _exam_context(request: ExamRequest | ExamItemRequest) -> dict:
    return {
        "asignatura": request.subject,
        "grado": request.grade,
        "temas": [
            {"clave": t.key, "titulo": t.title, "descripcion": t.description}
            for t in request.topics
        ],
        "objetivos": request.objectives,
        "dba": [
            {"codigo": d.code, "enunciado": d.statement, "evidencias": d.evidences}
            for d in request.dba
        ],
        "dificultad": DIFFICULTY_LABELS[request.difficulty],
        "notasDelDocente": request.notes,
        "preferenciasDelDocente": request.preferences,
    }


def build_section_messages(
    request: ExamRequest, plan: SectionPlan, index: int, previous: list[str]
) -> list[Message]:
    spec = plan.spec
    data = {
        "tarea": "examen_seccion",
        **_exam_context(request),
        "duracionExamenMinutos": request.durationMinutes,
        "seccion": {
            "numero": index + 1,
            "de": len(request.sections),
            "tipo": spec.questionType,
            "cantidadPreguntas": spec.questionCount,
            "puntosPorPregunta": spec.pointsPerQuestion,
            "indicacionesDelDocente": spec.instructions,
        },
        "preguntasPorNivel": plan.levels,
        "temasObligatorios": plan.topics,
        # Enunciados de las secciones anteriores, para no repetirlos.
        "preguntasYaHechas": previous[-40:],
    }
    instruction = (
        f"Elabora la sección {index + 1} del examen: exactamente {spec.questionCount} "
        f"preguntas de tipo {spec.questionType} ({TYPE_LABELS[spec.questionType]})."
    )
    return _messages(EXAM_PROMPT, instruction, data)


def build_exam_item_messages(request: ExamItemRequest) -> list[Message]:
    data = {
        "tarea": "examen_item",
        **_exam_context(request),
        "puntos": request.points,
        "actual": request.current.model_dump(),
        "indicacionDelDocente": request.instruction,
        "otrosItems": request.otherItems,
    }
    return _messages(
        EXAM_ITEM_PROMPT,
        "Reescribe la pregunta del examen siguiendo la indicación del docente.",
        data,
    )


# --- Validador pedagógico ----------------------------------------------------------------------


def _as_quiz(q: ExamQuestion) -> QuizQuestion:
    return QuizQuestion(
        type=q.type,  # type: ignore[arg-type]
        stem=q.stem,
        options=q.options,
        answer=q.answer,
        explanation=q.explanation,
        cognitiveLevel=q.cognitiveLevel,
        dbaCodes=q.dbaCodes,
    )


def exam_question_errors(
    q: ExamQuestion,
    label: str,
    question_type: str,
    points: float,
    topic_keys: set[str],
    allowed: set[str],
) -> list[str]:
    errors: list[str] = []
    if q.type != question_type:
        return [f"{label}: esta sección solo admite preguntas de tipo {question_type}"]
    if q.topic not in topic_keys:
        # RN-07: un tema fuera del contexto invalida la salida.
        errors.append(f"{label}: 'topic' debe ser una de las claves de 'temas' ({q.topic})")
    if q.type in ("MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"):
        errors += question_errors(_as_quiz(q), label, [q.type], allowed)
        return errors
    if not 5 <= len(q.stem.strip()) <= 600:
        errors.append(f"{label}: el enunciado debe tener entre 5 y 600 caracteres")
    if len(q.explanation.strip()) < 5:
        errors.append(f"{label}: falta la justificación para el docente")
    unknown = [c for c in q.dbaCodes if c not in allowed]
    if unknown:
        errors.append(f"{label}: cita DBA que no están en los datos: {', '.join(unknown)}")
    if allowed and not q.dbaCodes:
        errors.append(f"{label}: debe citar al menos un DBA de los datos")
    if q.type == "MATCHING":
        if not PAIRS_MIN <= len(q.pairs) <= PAIRS_MAX:
            errors.append(
                f"{label}: el emparejamiento necesita entre {PAIRS_MIN} y {PAIRS_MAX} pares"
            )
        lefts = [norm(p.left) for p in q.pairs]
        rights = [norm(p.right) for p in q.pairs] + [norm(d) for d in q.distractors]
        if len(set(lefts)) != len(lefts) or any(not x for x in lefts):
            errors.append(f"{label}: hay elementos vacíos o repetidos en la columna A")
        if len(set(rights)) != len(rights) or any(not x for x in rights):
            errors.append(f"{label}: hay elementos vacíos o repetidos en la columna B")
        if len(q.distractors) > MAX_DISTRACTORS:
            errors.append(f"{label}: máximo {MAX_DISTRACTORS} distractores en la columna B")
    else:  # OPEN
        if len(q.answer.strip()) < 5:
            errors.append(f"{label}: falta la respuesta esperada")
        if not CRITERIA_MIN <= len(q.criteria) <= CRITERIA_MAX:
            errors.append(
                f"{label}: la pregunta abierta necesita entre {CRITERIA_MIN} y {CRITERIA_MAX} "
                "criterios de calificación"
            )
        elif any(c.points <= 0 or not _one_decimal(c.points) for c in q.criteria):
            errors.append(f"{label}: cada criterio vale más de 0 puntos, con máximo un decimal")
        else:
            total = round(sum(c.points for c in q.criteria), 1)
            if abs(total - points) > 0.05:
                # RN-05: los criterios suman los puntos de la pregunta.
                errors.append(
                    f"{label}: los puntos de los criterios suman {total} y deben sumar {points}"
                )
        if any(len(c.description.strip()) < 5 for c in q.criteria):
            errors.append(f"{label}: describe cada criterio de calificación")
    return errors


def validate_section(
    out: SectionOut,
    request: ExamRequest,
    plan: SectionPlan,
    index: int,
    previous: list[str],
    level_debt: dict[str, int],
) -> list[str]:
    spec = plan.spec
    errors: list[str] = []
    allowed = {d.code for d in request.dba}
    keys = {t.key for t in request.topics}
    if len(out.questions) != spec.questionCount:
        errors.append(
            f"La sección {index + 1} debe tener {spec.questionCount} preguntas "
            f"y llegaron {len(out.questions)}"
        )
    seen = {norm(s) for s in previous}
    for i, q in enumerate(out.questions, start=1):
        label = f"Pregunta {i}"
        errors += exam_question_errors(
            q, label, spec.questionType, spec.pointsPerQuestion, keys, allowed
        )
        if norm(q.stem) in seen and q.type != "MATCHING":
            errors.append(f"{label}: repite otra pregunta del examen")
        seen.add(norm(q.stem))
    got = {q.topic for q in out.questions}
    missing = [k for k in plan.topics if k not in got]
    if missing and len(out.questions) == spec.questionCount:
        errors.append(f"Faltan preguntas de los temas obligatorios: {', '.join(missing)}")
    # Distribución cognitiva: la deuda acumulada de las secciones anteriores más esta sección
    # debe quedar dentro de ±1 por nivel, así el examen completo cumple RN-03.
    for level in LEVELS:
        actual = sum(1 for q in out.questions if q.cognitiveLevel == level)
        expected = plan.levels.get(level, 0)
        if request.cognitiveDistribution.get(level, 0) == 0 and actual:
            errors.append(f"El nivel {level} no se pidió y aparece {actual} vez/veces")
        elif abs(level_debt.get(level, 0) + actual - expected) > 1:
            errors.append(f"El nivel {level} debe tener {expected} preguntas y tiene {actual}")
    text = " ".join(
        [q.stem for q in out.questions] + [p.left for q in out.questions for p in q.pairs]
    )
    if out.questions and not looks_spanish(text):
        errors.append("La sección no parece estar en español")
    return errors


def validate_exam_item(out: ExamItemOut, request: ExamItemRequest) -> list[str]:
    item = out.item
    keys = {t.key for t in request.topics}
    allowed = {d.code for d in request.dba}
    errors = exam_question_errors(
        item, "Pregunta", request.current.type, request.points, keys, allowed
    )
    current = norm(request.current.stem + "".join(p.left for p in request.current.pairs))
    text = norm(item.stem + "".join(p.left for p in item.pairs))
    if text == current:
        errors.append("La pregunta nueva es igual a la actual: aplica la indicación del docente")
    if norm(item.stem) in {norm(t) for t in request.otherItems}:
        errors.append("La pregunta nueva repite otra pregunta del examen")
    if not looks_spanish(item.stem):
        errors.append("La pregunta no parece estar en español")
    return errors


# --- Normalización ---------------------------------------------------------------------------


def clean_exam_question(q: ExamQuestion, question_type: str) -> ExamQuestion:
    update: dict = {
        "stem": q.stem.strip(),
        "explanation": q.explanation.strip(),
        "dbaCodes": list(dict.fromkeys(q.dbaCodes)),
    }
    if question_type in ("MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"):
        cleaned = _clean_question(_as_quiz(q))
        update |= {"options": cleaned.options, "answer": cleaned.answer}
        update |= {"pairs": [], "distractors": [], "criteria": []}
    elif question_type == "MATCHING":
        update |= {
            "options": [],
            "answer": "",
            "criteria": [],
            "pairs": [Pair(left=p.left.strip(), right=p.right.strip()) for p in q.pairs],
            "distractors": [d.strip() for d in q.distractors],
        }
    else:
        update |= {
            "options": [],
            "pairs": [],
            "distractors": [],
            "answer": q.answer.strip(),
            "criteria": [
                Criterion(description=c.description.strip(), points=round(c.points, 1))
                for c in q.criteria
            ],
        }
    return q.model_copy(update=update)


def trim_section(out: SectionOut, plan: SectionPlan) -> SectionOut:
    """Si llegan preguntas de más, se quedan las que mejor cumplen el plan, en su orden.

    Primero una pregunta por cada tema obligatorio, luego las que completan los niveles pedidos y
    al final las que falten. El resultado sigue pasando por el validador completo (el benchmark
    de CA-0011-14 mostró secciones largas con dos preguntas de más en cada intento).
    """
    count = plan.spec.questionCount
    questions = out.questions
    if len(questions) <= count:
        return out
    chosen: list[int] = []
    levels: dict[str, int] = {}

    def take(i: int) -> None:
        chosen.append(i)
        level = questions[i].cognitiveLevel
        levels[level] = levels.get(level, 0) + 1

    for topic in plan.topics:
        candidates = [i for i, q in enumerate(questions) if q.topic == topic and i not in chosen]
        fitting = [
            i
            for i in candidates
            if levels.get(questions[i].cognitiveLevel, 0)
            < plan.levels.get(questions[i].cognitiveLevel, 0)
        ]
        if (fitting or candidates) and len(chosen) < count:
            take((fitting or candidates)[0])
    for i, q in enumerate(questions):
        if len(chosen) >= count:
            break
        if i not in chosen and levels.get(q.cognitiveLevel, 0) < plan.levels.get(
            q.cognitiveLevel, 0
        ):
            take(i)
    for i in range(len(questions)):
        if len(chosen) >= count:
            break
        if i not in chosen:
            take(i)
    return SectionOut(questions=[questions[i] for i in sorted(chosen)])


# --- Funciones públicas ----------------------------------------------------------------------

# Tokens de salida por pregunta según el tipo, para pedir lo justo y no pasarse del cupo por minuto.
TOKENS_PER_QUESTION = {
    "MULTIPLE_CHOICE": 260,
    "TRUE_FALSE": 160,
    "SHORT_ANSWER": 180,
    "MATCHING": 700,
    "OPEN": 450,
}


def generate_exam(llm: LLM, request: ExamRequest) -> ExamResult:
    """Genera sección por sección (RN-10). Si una sección no logra salida válida, falla todo."""
    plans = plan_sections(request)
    previous: list[str] = []
    debt: dict[str, int] = {}
    calls: list[StructuredResult[SectionOut]] = []
    sections: list[ExamSectionResult] = []
    for index, plan in enumerate(plans):
        snapshot_previous, snapshot_debt = list(previous), dict(debt)
        result = run_structured(
            llm,
            build_section_messages(request, plan, index, snapshot_previous),
            SectionOut,
            lambda out, p=plan, i=index, prev=snapshot_previous, d=snapshot_debt: validate_section(
                out, request, p, i, prev, d
            ),
            max_tokens=300 + TOKENS_PER_QUESTION[plan.spec.questionType] * plan.spec.questionCount,
            max_wait_s=BACKGROUND_MAX_WAIT_S,
            normalize=lambda out, p=plan: trim_section(out, p),
        )
        questions = [clean_exam_question(q, plan.spec.questionType) for q in result.value.questions]
        for level in LEVELS:
            actual = sum(1 for q in questions if q.cognitiveLevel == level)
            debt[level] = debt.get(level, 0) + actual - plan.levels.get(level, 0)
        previous += [q.stem for q in questions]
        sections.append(
            ExamSectionResult(
                questionType=plan.spec.questionType,
                pointsPerQuestion=plan.spec.pointsPerQuestion,
                questions=questions,
            )
        )
        calls.append(result)
    last = calls[-1]
    return ExamResult(
        value=ExamOut(sections=sections), provider=last.provider, model=last.model, calls=calls
    )


def regenerate_exam_item(llm: LLM, request: ExamItemRequest) -> StructuredResult[ExamItemOut]:
    result = run_structured(
        llm,
        build_exam_item_messages(request),
        ExamItemOut,
        lambda out: validate_exam_item(out, request),
        max_tokens=300 + TOKENS_PER_QUESTION[request.current.type],
    )
    item = clean_exam_question(result.value.item, request.current.type)
    return replace(result, value=ExamItemOut(item=item))
