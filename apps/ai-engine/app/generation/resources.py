"""Generación de quices y talleres, y regeneración de una pregunta o actividad (SPEC-0008).

Cada función arma el contexto como datos delimitados, corre el pipeline estructurado y valida
el resultado contra el blueprint del docente (RN-03, RN-04, RN-10).
"""

import json
from dataclasses import replace
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..config import ENGINE_DIR
from ..providers.llm import DATA_END, DATA_START, LLM, Message
from .objectives import DbaRef, TopicRef
from .pipeline import StructuredResult, looks_spanish, norm, run_structured

# Los recursos se generan en segundo plano (ADR-0008): vale la pena esperar a que se libere el cupo
# por minuto de Groq antes de caer al modelo local, que en CPU no alcanza para un taller.
BACKGROUND_MAX_WAIT_S = 60.0

QUIZ_PROMPT_VERSION = "quiz.v1"
WORKSHOP_PROMPT_VERSION = "workshop.v1"
# SPEC-0010: taller con las secciones del formato propio del docente.
WORKSHOP_CUSTOM_PROMPT_VERSION = "workshop.v2"
ITEM_PROMPT_VERSION = "item_regenerate.v1"


def _prompt(version: str) -> str:
    return (ENGINE_DIR / "prompts" / f"{version}.md").read_text(encoding="utf8")


QUIZ_PROMPT = _prompt(QUIZ_PROMPT_VERSION)
WORKSHOP_PROMPT = _prompt(WORKSHOP_PROMPT_VERSION)
WORKSHOP_CUSTOM_PROMPT = _prompt(WORKSHOP_CUSTOM_PROMPT_VERSION)
ITEM_PROMPT = _prompt(ITEM_PROMPT_VERSION)

Level = Literal["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]
LEVELS: tuple[Level, ...] = ("REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE")
LEVEL_LABELS = {
    "REMEMBER": "recordar",
    "UNDERSTAND": "comprender",
    "APPLY": "aplicar",
    "ANALYZE": "analizar",
    "EVALUATE": "evaluar",
    "CREATE": "crear",
}
QuestionType = Literal["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]
Difficulty = Literal["BASIC", "INTERMEDIATE", "ADVANCED"]
DIFFICULTY_LABELS = {"BASIC": "básica", "INTERMEDIATE": "intermedia", "ADVANCED": "avanzada"}
Structure = Literal[
    "START_DEVELOPMENT_CLOSE",
    "EXPLORE_PRACTICE_APPLY",
    "EXPERIENCE_FOUNDATION_EXERCISE_APPLY",
    "PROBLEM_SITUATION",
]
# RN-10: momentos de cada estructura de taller, en orden.
STRUCTURE_MOMENTS: dict[str, list[str]] = {
    "START_DEVELOPMENT_CLOSE": ["Inicio", "Desarrollo", "Cierre"],
    "EXPLORE_PRACTICE_APPLY": ["Exploración", "Práctica", "Aplicación"],
    "EXPERIENCE_FOUNDATION_EXERCISE_APPLY": [
        "Vivencia",
        "Fundamentación",
        "Ejercitación",
        "Aplicación",
    ],
    "PROBLEM_SITUATION": [
        "Planteamiento del problema",
        "Investigación",
        "Propuesta de solución",
        "Socialización",
    ],
}
TRUE_FALSE = ["Verdadero", "Falso"]
# Opciones que no evalúan nada (RN-04).
FORBIDDEN_OPTIONS = (
    "todas las anteriores",
    "ninguna de las anteriores",
    "todas son correctas",
    "ninguna es correcta",
    "a y b",
)

Text = Annotated[str, Field(max_length=500)]


class ResourceContext(BaseModel):
    """Contexto pedagógico común. `extra="forbid"`: no caben datos personales (RN-02)."""

    model_config = ConfigDict(extra="forbid")
    subject: str = Field(max_length=80)
    grade: str = Field(max_length=20)
    topic: TopicRef
    objectives: list[Text] = Field(default_factory=list, max_length=5)
    dba: list[DbaRef] = Field(default_factory=list, max_length=40)
    difficulty: Difficulty = "INTERMEDIATE"
    notes: str | None = Field(default=None, max_length=500)
    # RN-07: indicaciones de mejora que el docente guardó como preferencia.
    preferences: list[Text] = Field(default_factory=list, max_length=5)


def _check_distribution(distribution: dict[str, int]) -> None:
    if sum(distribution.values()) != 100:
        raise ValueError("La distribución cognitiva debe sumar 100")
    if any(v < 0 for v in distribution.values()):
        raise ValueError("La distribución cognitiva no admite valores negativos")


class QuizRequest(ResourceContext):
    durationMinutes: int = Field(ge=15, le=180)  # noqa: N815
    itemCount: int = Field(ge=3, le=15)  # noqa: N815
    questionTypes: list[QuestionType] = Field(min_length=1, max_length=3)  # noqa: N815
    cognitiveDistribution: dict[Level, int]  # noqa: N815

    @model_validator(mode="after")
    def _valid(self):
        _check_distribution(self.cognitiveDistribution)
        if len(set(self.questionTypes)) != len(self.questionTypes):
            raise ValueError("Tipos de pregunta repetidos")
        return self


class CustomSection(BaseModel):
    """Sección del formato del docente que la IA debe llenar (SPEC-0010). Las fijas no se envían."""

    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=120)
    kind: Literal["ACTIVITIES", "TEXT"]
    purpose: str = Field(default="", max_length=300)


class WorkshopRequest(ResourceContext):
    durationMinutes: int = Field(ge=15, le=180)  # noqa: N815
    itemCount: int = Field(ge=2, le=8)  # noqa: N815
    structure: Structure | Literal["CUSTOM"]
    customSections: list[CustomSection] = Field(default_factory=list, max_length=10)  # noqa: N815
    cognitiveDistribution: dict[Level, int]  # noqa: N815

    @model_validator(mode="after")
    def _valid(self):
        _check_distribution(self.cognitiveDistribution)
        if self.structure == "CUSTOM":
            titles = [norm(c.title) for c in self.customSections]
            if len(set(titles)) != len(titles):
                raise ValueError("Hay secciones con el mismo título")
            if not any(c.kind == "ACTIVITIES" for c in self.customSections):
                raise ValueError("El formato necesita al menos una sección de actividades")
        elif self.customSections:
            raise ValueError("Las secciones personalizadas solo van con structure=CUSTOM")
        if self.itemCount < len(moments_for(self)):
            raise ValueError("Cada momento del taller necesita al menos una actividad")
        return self


def moments_for(request: "WorkshopRequest") -> list[str]:
    """Momentos con actividades: los de la estructura elegida o las secciones del formato."""
    if request.structure == "CUSTOM":
        return [c.title for c in request.customSections if c.kind == "ACTIVITIES"]
    return STRUCTURE_MOMENTS[request.structure]


def text_sections(request: "WorkshopRequest") -> list[CustomSection]:
    return [c for c in request.customSections if c.kind == "TEXT"]


def workshop_prompt_version(request: "WorkshopRequest") -> str:
    return (
        WORKSHOP_CUSTOM_PROMPT_VERSION if request.structure == "CUSTOM" else WORKSHOP_PROMPT_VERSION
    )


class QuizQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: QuestionType
    stem: str = Field(max_length=1000)
    options: list[str] = Field(default_factory=list, max_length=6)
    answer: str = Field(max_length=600)
    explanation: str = Field(max_length=1000)
    cognitiveLevel: Level  # noqa: N815
    dbaCodes: list[str] = Field(default_factory=list, max_length=6)  # noqa: N815


class QuizOut(BaseModel):
    title: str = Field(max_length=200)
    instructions: str = Field(max_length=1500)
    questions: list[QuizQuestion]


class Activity(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(max_length=200)
    instructions: str = Field(max_length=2500)
    durationMinutes: int  # noqa: N815
    expectedOutcome: str = Field(max_length=800)  # noqa: N815
    cognitiveLevel: Level  # noqa: N815
    dbaCodes: list[str] = Field(default_factory=list, max_length=6)  # noqa: N815


class Moment(BaseModel):
    name: str = Field(max_length=80)
    activities: list[Activity]


class SectionText(BaseModel):
    title: str = Field(max_length=120)
    content: str = Field(max_length=4000)


class WorkshopOut(BaseModel):
    title: str = Field(max_length=200)
    purpose: str = Field(max_length=1000)
    studentInstructions: str = Field(max_length=1500)  # noqa: N815
    materials: list[Annotated[str, Field(max_length=200)]] = Field(
        default_factory=list, max_length=12
    )
    moments: list[Moment]
    teacherGuidance: list[Annotated[str, Field(max_length=600)]] = Field(  # noqa: N815
        default_factory=list, max_length=8
    )
    # Contenido de las secciones de texto del formato (SPEC-0010); vacío en las estructuras fijas.
    sectionTexts: list[SectionText] = Field(default_factory=list, max_length=10)  # noqa: N815


class ItemRequest(ResourceContext):
    """Regenerar una pregunta o actividad con la indicación del docente (CA-0008-07)."""

    kind: Literal["QUIZ_QUESTION", "WORKSHOP_ACTIVITY"]
    current: QuizQuestion | Activity
    instruction: str = Field(min_length=3, max_length=300)
    durationMinutes: int = Field(ge=15, le=180)  # noqa: N815
    # Quiz: tipos permitidos. Taller: momento al que pertenece la actividad.
    questionTypes: list[QuestionType] = Field(default_factory=list, max_length=3)  # noqa: N815
    moment: str | None = Field(default=None, max_length=80)
    # Enunciados o títulos del resto del recurso, para no repetirlos.
    otherItems: list[Annotated[str, Field(max_length=1000)]] = Field(  # noqa: N815
        default_factory=list, max_length=20
    )

    @model_validator(mode="after")
    def _valid(self):
        is_question = isinstance(self.current, QuizQuestion)
        if is_question != (self.kind == "QUIZ_QUESTION"):
            raise ValueError("`current` no corresponde a `kind`")
        if is_question and not self.questionTypes:
            raise ValueError("Faltan los tipos de pregunta permitidos")
        return self


class ItemOut(BaseModel):
    item: QuizQuestion | Activity


# --- Distribución cognitiva ------------------------------------------------------------------


def target_counts(distribution: dict[str, int], total: int) -> dict[str, int]:
    """Cantidad de ítems por nivel (método del mayor residuo): suma exactamente `total`."""
    raw = {level: distribution.get(level, 0) * total / 100 for level in LEVELS}
    counts = {level: int(value) for level, value in raw.items()}
    remaining = total - sum(counts.values())
    by_remainder = sorted(LEVELS, key=lambda lv: (raw[lv] - counts[lv], raw[lv]), reverse=True)
    for level in by_remainder[:remaining]:
        counts[level] += 1
    return {level: n for level, n in counts.items() if n}


def _distribution_errors(levels: list[str], distribution: dict[str, int]) -> list[str]:
    target = target_counts(distribution, len(levels))
    errors = []
    for level in LEVELS:
        actual = levels.count(level)
        expected = target.get(level, 0)
        if distribution.get(level, 0) == 0 and actual:
            errors.append(f"El nivel {level} no se pidió y aparece {actual} vez/veces")
        elif abs(actual - expected) > 1:
            errors.append(f"El nivel {level} debe tener {expected} ítems (±1) y tiene {actual}")
    return errors


# --- Mensajes --------------------------------------------------------------------------------


def _context_data(request: ResourceContext) -> dict:
    return {
        "asignatura": request.subject,
        "grado": request.grade,
        "tema": {"titulo": request.topic.title, "descripcion": request.topic.description},
        "objetivos": request.objectives,
        "dba": [
            {"codigo": d.code, "enunciado": d.statement, "evidencias": d.evidences}
            for d in request.dba
        ],
        "dificultad": DIFFICULTY_LABELS[request.difficulty],
        "notasDelDocente": request.notes,
        "preferenciasDelDocente": request.preferences,
    }


def _messages(system: str, instruction: str, data: dict) -> list[Message]:
    """Instrucciones fijas en el rol de sistema; el contexto va como datos delimitados (§19)."""
    user = (
        f"{instruction}\n{DATA_START}\n{json.dumps(data, ensure_ascii=False)}\n{DATA_END}\n"
        "Responde solo con el JSON pedido."
    )
    return [Message("system", system), Message("user", user)]


def build_quiz_messages(request: QuizRequest) -> list[Message]:
    data = {
        "tarea": "quiz",
        **_context_data(request),
        "duracionMinutos": request.durationMinutes,
        "cantidadPreguntas": request.itemCount,
        "tiposPermitidos": request.questionTypes,
        "preguntasPorNivel": target_counts(request.cognitiveDistribution, request.itemCount),
    }
    return _messages(
        QUIZ_PROMPT, f"Elabora un quiz de exactamente {request.itemCount} preguntas.", data
    )


def build_workshop_messages(request: WorkshopRequest) -> list[Message]:
    data = {
        "tarea": "taller",
        **_context_data(request),
        "duracionMinutos": request.durationMinutes,
        "cantidadActividades": request.itemCount,
        "momentos": moments_for(request),
        "actividadesPorNivel": target_counts(request.cognitiveDistribution, request.itemCount),
    }
    if request.structure == "CUSTOM":
        data["secciones"] = [
            {
                "titulo": c.title,
                "tipo": "actividades" if c.kind == "ACTIVITIES" else "texto",
                "proposito": c.purpose,
            }
            for c in request.customSections
        ]
    return _messages(
        WORKSHOP_CUSTOM_PROMPT if request.structure == "CUSTOM" else WORKSHOP_PROMPT,
        f"Elabora un taller con exactamente {request.itemCount} actividades en total.",
        data,
    )


def build_item_messages(request: ItemRequest) -> list[Message]:
    data = {
        "tarea": "item",
        "tipo": "pregunta" if request.kind == "QUIZ_QUESTION" else "actividad",
        **_context_data(request),
        "duracionMinutosDelRecurso": request.durationMinutes,
        "tiposPermitidos": request.questionTypes,
        "momento": request.moment,
        "actual": request.current.model_dump(),
        "indicacionDelDocente": request.instruction,
        "otrosItems": request.otherItems,
    }
    noun = "la pregunta" if request.kind == "QUIZ_QUESTION" else "la actividad"
    return _messages(ITEM_PROMPT, f"Reescribe {noun} siguiendo la indicación del docente.", data)


# --- Validadores pedagógicos -----------------------------------------------------------------


def _code_errors(label: str, codes: list[str], allowed: set[str]) -> list[str]:
    errors = []
    unknown = [c for c in codes if c not in allowed]
    if unknown:
        # RN-03: evidence over hallucination.
        errors.append(f"{label}: cita DBA que no están en los datos: {', '.join(unknown)}")
    if allowed and not codes:
        errors.append(f"{label}: debe citar al menos un DBA de los datos")
    return errors


def question_errors(
    q: QuizQuestion, label: str, allowed_types: list[str], allowed: set[str]
) -> list[str]:
    errors: list[str] = []
    if q.type not in allowed_types:
        errors.append(f"{label}: el tipo {q.type} no está permitido")
    if not 5 <= len(q.stem.strip()) <= 600:
        errors.append(f"{label}: el enunciado debe tener entre 5 y 600 caracteres")
    if len(q.explanation.strip()) < 5:
        errors.append(f"{label}: falta la justificación de la respuesta")
    answer = norm(q.answer)
    if q.type == "MULTIPLE_CHOICE":
        options = [norm(o) for o in q.options]
        if not 3 <= len(options) <= 5:
            errors.append(f"{label}: selección múltiple necesita entre 3 y 5 opciones")
        if len(set(options)) != len(options) or any(not o for o in options):
            errors.append(f"{label}: hay opciones vacías o repetidas")
        if any(f in o for o in options for f in FORBIDDEN_OPTIONS):
            errors.append(f"{label}: no uses opciones como 'todas/ninguna de las anteriores'")
        if options.count(answer) != 1:
            errors.append(f"{label}: 'answer' debe ser exactamente el texto de una de las opciones")
    elif q.type == "TRUE_FALSE":
        if answer not in ("verdadero", "falso"):
            errors.append(f"{label}: en verdadero/falso 'answer' es 'Verdadero' o 'Falso'")
    elif not answer:
        errors.append(f"{label}: falta la respuesta esperada")
    errors += _code_errors(label, q.dbaCodes, allowed)
    return errors


def validate_quiz(out: QuizOut, request: QuizRequest) -> list[str]:
    errors: list[str] = []
    allowed = {d.code for d in request.dba}
    if len(out.questions) != request.itemCount:
        errors.append(f"Se pidieron {request.itemCount} preguntas y llegaron {len(out.questions)}")
    if not 3 <= len(out.title.strip()) <= 150:
        errors.append("El título debe tener entre 3 y 150 caracteres")
    seen: set[str] = set()
    for i, q in enumerate(out.questions, start=1):
        errors += question_errors(q, f"Pregunta {i}", request.questionTypes, allowed)
        if norm(q.stem) in seen:
            errors.append(f"Pregunta {i}: está repetida")
        seen.add(norm(q.stem))
    if not looks_spanish(" ".join([out.instructions, *(q.stem for q in out.questions)])):
        errors.append("El quiz no parece estar en español")
    errors += _distribution_errors(
        [q.cognitiveLevel for q in out.questions], request.cognitiveDistribution
    )
    return errors


def activity_errors(a: Activity, label: str, max_minutes: int, allowed: set[str]) -> list[str]:
    errors: list[str] = []
    if not 3 <= len(a.title.strip()) <= 150:
        errors.append(f"{label}: el título debe tener entre 3 y 150 caracteres")
    if len(a.instructions.strip()) < 20:
        errors.append(f"{label}: las instrucciones son muy cortas")
    if len(a.expectedOutcome.strip()) < 5:
        errors.append(f"{label}: falta el producto o resultado esperado")
    if not 2 <= a.durationMinutes <= max_minutes:
        errors.append(f"{label}: la duración debe estar entre 2 y {max_minutes} minutos")
    errors += _code_errors(label, a.dbaCodes, allowed)
    return errors


def validate_workshop(out: WorkshopOut, request: WorkshopRequest) -> list[str]:
    errors: list[str] = []
    allowed = {d.code for d in request.dba}
    expected = moments_for(request)
    names = [m.name for m in out.moments]
    if [norm(n) for n in names] != [norm(n) for n in expected]:
        errors.append(
            f"Los momentos deben ser exactamente, en orden: {', '.join(expected)} "
            f"(llegaron: {', '.join(names)})"
        )
    activities = [a for m in out.moments for a in m.activities]
    if len(activities) != request.itemCount:
        errors.append(
            f"Se pidieron {request.itemCount} actividades en total y llegaron {len(activities)}"
        )
    for m in out.moments:
        if not m.activities:
            errors.append(f"El momento '{m.name}' necesita al menos una actividad")
    if not 3 <= len(out.title.strip()) <= 150:
        errors.append("El título debe tener entre 3 y 150 caracteres")
    if len(out.purpose.strip()) < 10:
        errors.append("Falta el propósito del taller")
    if not out.teacherGuidance:
        errors.append("Faltan las orientaciones para el docente")
    seen: set[str] = set()
    for i, a in enumerate(activities, start=1):
        errors += activity_errors(a, f"Actividad {i}", request.durationMinutes, allowed)
        if norm(a.title) in seen:
            errors.append(f"Actividad {i}: el título está repetido")
        seen.add(norm(a.title))
    total = sum(a.durationMinutes for a in activities)
    if not request.durationMinutes * 0.5 <= total <= request.durationMinutes * 1.1:
        errors.append(
            f"Las actividades suman {total} minutos; deben ajustarse a {request.durationMinutes}"
        )
    if not looks_spanish(" ".join([out.purpose, *(a.instructions for a in activities)])):
        errors.append("El taller no parece estar en español")
    errors += _distribution_errors(
        [a.cognitiveLevel for a in activities], request.cognitiveDistribution
    )
    texts = text_sections(request)
    got = [norm(t.title) for t in out.sectionTexts]
    if got != [norm(t.title) for t in texts]:
        names = ", ".join(t.title for t in texts) or "ninguna"
        errors.append(f"'sectionTexts' debe traer, en orden, las secciones de texto: {names}")
    for t in out.sectionTexts:
        if not 30 <= len(t.content.strip()) <= 3000:
            errors.append(f"La sección '{t.title}' debe tener entre 30 y 3000 caracteres")
    return errors


def validate_item(out: ItemOut, request: ItemRequest) -> list[str]:
    allowed = {d.code for d in request.dba}
    others = {norm(t) for t in request.otherItems}
    item = out.item
    if request.kind == "QUIZ_QUESTION":
        if not isinstance(item, QuizQuestion):
            return ["Debe llegar una pregunta (type, stem, options, answer, explanation, ...)"]
        errors = question_errors(item, "Pregunta", request.questionTypes, allowed)
        text, current = item.stem, request.current.stem  # type: ignore[union-attr]
    else:
        if not isinstance(item, Activity):
            return ["Debe llegar una actividad (title, instructions, durationMinutes, ...)"]
        errors = activity_errors(item, "Actividad", request.durationMinutes, allowed)
        text = item.title + item.instructions
        current = request.current.title + request.current.instructions  # type: ignore[union-attr]
    if norm(text) == norm(current):
        errors.append("El ítem nuevo es igual al actual: aplica la indicación del docente")
    if norm(text) in others:
        errors.append("El ítem nuevo repite otro ítem del recurso")
    if not looks_spanish(text):
        errors.append("El ítem no parece estar en español")
    return errors


# --- Normalización ---------------------------------------------------------------------------


def _clean_question(q: QuizQuestion) -> QuizQuestion:
    if q.type == "TRUE_FALSE":
        answer = "Verdadero" if norm(q.answer) == "verdadero" else "Falso"
        options = TRUE_FALSE
    elif q.type == "MULTIPLE_CHOICE":
        options = [o.strip() for o in q.options]
        answer = next(o for o in options if norm(o) == norm(q.answer))
    else:
        options, answer = [], q.answer.strip()
    return q.model_copy(
        update={
            "stem": q.stem.strip(),
            "options": options,
            "answer": answer,
            "explanation": q.explanation.strip(),
            "dbaCodes": list(dict.fromkeys(q.dbaCodes)),
        }
    )


def _clean_activity(a: Activity) -> Activity:
    return a.model_copy(
        update={"title": a.title.strip(), "dbaCodes": list(dict.fromkeys(a.dbaCodes))}
    )


# --- Funciones públicas ----------------------------------------------------------------------


def generate_quiz(llm: LLM, request: QuizRequest) -> StructuredResult[QuizOut]:
    result = run_structured(
        llm,
        build_quiz_messages(request),
        QuizOut,
        lambda out: validate_quiz(out, request),
        max_tokens=600 + 260 * request.itemCount,
        max_wait_s=BACKGROUND_MAX_WAIT_S,
    )
    quiz = result.value.model_copy(
        update={"questions": [_clean_question(q) for q in result.value.questions]}
    )
    return replace(result, value=quiz)


def generate_workshop(llm: LLM, request: WorkshopRequest) -> StructuredResult[WorkshopOut]:
    result = run_structured(
        llm,
        build_workshop_messages(request),
        WorkshopOut,
        lambda out: validate_workshop(out, request),
        max_tokens=900 + 320 * request.itemCount + 450 * len(text_sections(request)),
        max_wait_s=BACKGROUND_MAX_WAIT_S,
    )
    # Los nombres de los momentos quedan con la ortografía canónica de la estructura.
    moments = [
        Moment(name=name, activities=[_clean_activity(a) for a in m.activities])
        for name, m in zip(moments_for(request), result.value.moments, strict=True)
    ]
    texts = [
        SectionText(title=section.title, content=t.content.strip())
        for section, t in zip(text_sections(request), result.value.sectionTexts, strict=True)
    ]
    workshop = result.value.model_copy(update={"moments": moments, "sectionTexts": texts})
    return replace(result, value=workshop)


def regenerate_item(llm: LLM, request: ItemRequest) -> StructuredResult[ItemOut]:
    result = run_structured(
        llm,
        build_item_messages(request),
        ItemOut,
        lambda out: validate_item(out, request),
        max_tokens=700,
    )
    item = result.value.item
    cleaned = _clean_question(item) if isinstance(item, QuizQuestion) else _clean_activity(item)
    return replace(result, value=ItemOut(item=cleaned))
