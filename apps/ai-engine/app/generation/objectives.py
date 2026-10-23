"""Sugerencia de objetivos de aprendizaje (SPEC-0007).

Pipeline (plan maestro §7): contexto → LLM → schema → validador pedagógico → reparación.
Nada inválido sale de aquí: si tras los reintentos la salida no cumple, se lanza un error.
"""

import json
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field

from ..config import ENGINE_DIR
from ..providers.llm import DATA_END, DATA_START, LLM, Message
from .pipeline import GenerationInvalidError as GenerationInvalidError
from .pipeline import norm as _norm
from .pipeline import run_structured

PROMPT_VERSION = "objective_suggestions.v1"
SYSTEM_PROMPT = (ENGINE_DIR / "prompts" / f"{PROMPT_VERSION}.md").read_text(encoding="utf8")

# Verbos que no describen una conducta observable (criterio pedagógico de la regla 2 del prompt).
NON_OBSERVABLE = {
    "conocer", "conoce", "entender", "entiende", "comprender", "comprende", "saber", "sabe",
    "aprender", "aprende", "apreciar", "aprecia", "familiarizarse", "familiariza",
}  # fmt: skip
SPANISH_HINTS = {
    "de",
    "la",
    "el",
    "en",
    "los",
    "las",
    "y",
    "con",
    "para",
    "del",
    "un",
    "una",
    "que",
    "su",
}


class DbaRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(max_length=60)
    statement: str = Field(max_length=1500)
    evidences: list[str] = Field(default_factory=list, max_length=12)


class TopicRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class ObjectiveRequest(BaseModel):
    """Contexto que envía la web.

    `extra="forbid"`: no hay ningún campo donde quepan datos personales (RN-02).
    """

    model_config = ConfigDict(extra="forbid")
    subject: str = Field(max_length=80)
    grade: str = Field(max_length=20)
    topic: TopicRef
    existingObjectives: list[str] = Field(default_factory=list, max_length=40)  # noqa: N815
    dba: list[DbaRef] = Field(default_factory=list, max_length=40)
    count: int = Field(default=3, ge=1, le=5)


class Suggestion(BaseModel):
    statement: str
    dbaCodes: list[str] = Field(default_factory=list)  # noqa: N815


class SuggestionsOut(BaseModel):
    suggestions: list[Suggestion]


@dataclass(frozen=True)
class GenerationResult:
    suggestions: list[Suggestion]
    provider: str
    model: str
    attempts: int
    latency_ms: int


def build_messages(request: ObjectiveRequest) -> list[Message]:
    """Instrucciones fijas en el rol de sistema; el contexto va como datos delimitados (§19)."""
    data = {
        "asignatura": request.subject,
        "grado": request.grade,
        "tema": {"titulo": request.topic.title, "descripcion": request.topic.description},
        "objetivosExistentes": request.existingObjectives,
        "dba": [
            {"codigo": d.code, "enunciado": d.statement, "evidencias": d.evidences}
            for d in request.dba
        ],
        "cantidad": request.count,
    }
    user = (
        f"Propón exactamente {request.count} objetivos de aprendizaje para el tema.\n"
        f"{DATA_START}\n{json.dumps(data, ensure_ascii=False)}\n{DATA_END}\n"
        "Responde solo con el JSON pedido."
    )
    return [Message("system", SYSTEM_PROMPT), Message("user", user)]


def validate(out: SuggestionsOut, request: ObjectiveRequest) -> list[str]:
    """Validador pedagógico (plan maestro §7). Devuelve los problemas encontrados."""
    errors: list[str] = []
    allowed = {d.code for d in request.dba}
    existing = {_norm(o) for o in request.existingObjectives}
    seen: set[str] = set()
    if len(out.suggestions) != request.count:
        errors.append(f"Se pidieron {request.count} objetivos y llegaron {len(out.suggestions)}")
    for i, s in enumerate(out.suggestions, start=1):
        text = s.statement.strip()
        words = _norm(text).split()
        if not 10 <= len(text) <= 300:
            errors.append(f"Objetivo {i}: debe tener entre 10 y 300 caracteres")
        if words and words[0] in NON_OBSERVABLE:
            errors.append(f"Objetivo {i}: empieza con un verbo no observable ({words[0]})")
        if not SPANISH_HINTS & set(words):
            errors.append(f"Objetivo {i}: no parece estar en español")
        if _norm(text) in existing:
            errors.append(f"Objetivo {i}: repite un objetivo que ya existe")
        if _norm(text) in seen:
            errors.append(f"Objetivo {i}: está repetido")
        seen.add(_norm(text))
        unknown = [c for c in s.dbaCodes if c not in allowed]
        if unknown:
            # RN-04: evidence over hallucination.
            errors.append(f"Objetivo {i}: cita DBA que no están en los datos: {', '.join(unknown)}")
        if allowed and not s.dbaCodes:
            errors.append(f"Objetivo {i}: debe citar al menos un DBA de los datos")
    return errors


def suggest_objectives(llm: LLM, request: ObjectiveRequest) -> GenerationResult:
    # RN-03: hasta 2 reparaciones con los errores concretos; si no, GenerationInvalidError.
    result = run_structured(
        llm,
        build_messages(request),
        SuggestionsOut,
        lambda out: validate(out, request),
        max_tokens=900,
    )
    return GenerationResult(
        suggestions=[
            Suggestion(statement=s.statement.strip(), dbaCodes=list(dict.fromkeys(s.dbaCodes)))
            for s in result.value.suggestions
        ],
        provider=result.provider,
        model=result.model,
        attempts=result.attempts,
        latency_ms=result.latency_ms,
    )
