"""Preferencias propuestas a partir de lo que hace el docente (SPEC-0021 Parte A, ADR-0016).

Contrato `generation-preference-suggestions.v1`. El pedido no admite ids ni datos personales
(`extra="forbid"`): llegan señales de un solo docente, ya sin correos ni teléfonos. La IA solo
resume; el docente decide si usa cada preferencia.
"""

import json
from dataclasses import replace
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from ..config import ENGINE_DIR
from ..providers.llm import DATA_END, DATA_START, LLM, Message
from .pipeline import StructuredResult, looks_spanish, norm, run_structured

PREFERENCES_PROMPT_VERSION = "preference_suggestions.v1"
PREFERENCES_PROMPT = (ENGINE_DIR / "prompts" / f"{PREFERENCES_PROMPT_VERSION}.md").read_text(
    encoding="utf8"
)
MAX_SUGGESTIONS = 3


class Signal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["EDIT", "ITEM_DOWN", "REGENERATION", "RESOURCE_COMMENT"]
    resourceType: Literal["QUIZ", "WORKSHOP", "EXAM"]  # noqa: N815
    subject: str = Field(min_length=1, max_length=80)
    grade: str = Field(min_length=1, max_length=20)
    before: str = Field(default="", max_length=600)
    after: str = Field(default="", max_length=600)
    comment: str = Field(default="", max_length=300)


Pref = Annotated[str, Field(max_length=300)]


class PreferenceSuggestionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    signals: list[Signal] = Field(min_length=1, max_length=30)
    activePreferences: list[Pref] = Field(default_factory=list, max_length=5)  # noqa: N815
    declined: list[Pref] = Field(default_factory=list, max_length=10)


class Suggestion(BaseModel):
    text: str = Field(max_length=400)
    reason: str = Field(max_length=400)
    conflictsWith: int | None = None  # noqa: N815


class PreferenceSuggestionsOut(BaseModel):
    suggestions: list[Suggestion] = Field(default_factory=list, max_length=6)


def _same(a: str, b: str) -> bool:
    x, y = norm(a).rstrip("."), norm(b).rstrip(".")
    return x == y or (min(len(x), len(y)) >= 10 and (x in y or y in x))


def build_preference_messages(request: PreferenceSuggestionsRequest) -> list[Message]:
    data = {
        "tarea": "preferencias",
        "senales": [
            {
                "tipo": s.kind,
                "recurso": s.resourceType,
                "asignatura": s.subject,
                "grado": s.grade,
                "antes": s.before,
                "despues": s.after,
                "comentario": s.comment,
            }
            for s in request.signals
        ],
        "preferenciasActivas": request.activePreferences,
        "descartadas": request.declined,
    }
    user = (
        "Propón preferencias a partir de estas señales del docente.\n"
        f"{DATA_START}\n{json.dumps(data, ensure_ascii=False)}\n{DATA_END}\n"
        "Responde solo con el JSON pedido."
    )
    return [Message("system", PREFERENCES_PROMPT), Message("user", user)]


def drop_known(
    out: PreferenceSuggestionsOut, request: PreferenceSuggestionsRequest
) -> PreferenceSuggestionsOut:
    """RN-04: lo que ya es preferencia activa o fue descartado no se propone (sin el modelo)."""
    known = [*request.activePreferences, *request.declined]
    kept: list[Suggestion] = []
    for s in out.suggestions:
        if any(_same(s.text, k) for k in known) or any(_same(s.text, k.text) for k in kept):
            continue
        kept.append(s)
    return PreferenceSuggestionsOut(suggestions=kept)


def validate_preferences(
    out: PreferenceSuggestionsOut, request: PreferenceSuggestionsRequest
) -> list[str]:
    errors: list[str] = []
    if len(out.suggestions) > MAX_SUGGESTIONS:
        errors.append(f"Propón como máximo {MAX_SUGGESTIONS} preferencias")
    for i, s in enumerate(out.suggestions, start=1):
        if not 10 <= len(s.text.strip()) <= 160:
            errors.append(f"Preferencia {i}: 'text' debe tener entre 10 y 160 caracteres")
        if not 10 <= len(s.reason.strip()) <= 200:
            errors.append(f"Preferencia {i}: 'reason' debe tener entre 10 y 200 caracteres")
        if s.conflictsWith is not None and not 0 <= s.conflictsWith < len(
            request.activePreferences
        ):
            errors.append(
                f"Preferencia {i}: 'conflictsWith' debe ser el índice de una preferencia activa"
            )
    text = " ".join(s.text + " " + s.reason for s in out.suggestions)
    if text.strip() and not looks_spanish(text):
        errors.append("Las preferencias no parecen estar en español")
    return errors


def suggest_preferences(
    llm: LLM, request: PreferenceSuggestionsRequest
) -> StructuredResult[PreferenceSuggestionsOut]:
    result = run_structured(
        llm,
        build_preference_messages(request),
        PreferenceSuggestionsOut,
        lambda out: validate_preferences(out, request),
        max_tokens=600,
        normalize=lambda out: drop_known(out, request),
    )
    clean = PreferenceSuggestionsOut(
        suggestions=[
            Suggestion(text=s.text.strip(), reason=s.reason.strip(), conflictsWith=s.conflictsWith)
            for s in result.value.suggestions
        ]
    )
    return replace(result, value=clean)
