"""Ajustes razonables del PIAR (SPEC-0017, contrato generation-piar.v1).

El pedido no tiene campos para datos personales (`extra="forbid"`): llegan la asignatura, el grado,
el periodo, los temas y las barreras ya sin el nombre del estudiante ni datos de contacto.
"""

import json
from dataclasses import replace
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from ..config import ENGINE_DIR
from ..providers.llm import DATA_END, DATA_START, LLM, Message
from .pipeline import StructuredResult, looks_spanish, norm, run_structured

PIAR_PROMPT_VERSION = "piar.v1"
PIAR_PROMPT = (ENGINE_DIR / "prompts" / f"{PIAR_PROMPT_VERSION}.md").read_text(encoding="utf8")

Item = Annotated[str, Field(max_length=400)]


class PiarRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject: str = Field(min_length=1, max_length=80)
    grade: str = Field(min_length=1, max_length=20)
    period: str = Field(min_length=1, max_length=40)
    topics: list[Annotated[str, Field(max_length=200)]] = Field(default_factory=list, max_length=12)
    barriers: str = Field(min_length=10, max_length=1500)


class PiarOut(BaseModel):
    curricular: list[Item] = Field(default_factory=list, max_length=5)
    didactic: list[Item] = Field(default_factory=list, max_length=5)
    evaluative: list[Item] = Field(default_factory=list, max_length=5)
    followUp: str = Field(default="", max_length=500)  # noqa: N815


LABELS = {"curricular": "curriculares", "didactic": "didácticos", "evaluative": "de evaluación"}


def build_piar_messages(request: PiarRequest) -> list[Message]:
    data = {
        "tarea": "piar",
        "asignatura": request.subject,
        "grado": request.grade,
        "periodo": request.period,
        "temas": request.topics,
        "barreras": request.barriers,
    }
    user = (
        "Propón los ajustes razonables del periodo para estas barreras.\n"
        f"{DATA_START}\n{json.dumps(data, ensure_ascii=False)}\n{DATA_END}\n"
        "Responde solo con el JSON pedido."
    )
    return [Message("system", PIAR_PROMPT), Message("user", user)]


def validate_piar(out: PiarOut, _request: PiarRequest) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for key, label in LABELS.items():
        items = [x for x in getattr(out, key) if x.strip()]
        if not 1 <= len(items) <= 3:
            errors.append(f"'{key}' debe traer de 1 a 3 ajustes {label}")
        for x in items:
            if not 10 <= len(x.strip()) <= 300:
                errors.append(f"'{key}': cada ajuste debe tener entre 10 y 300 caracteres")
            if norm(x) in seen:
                errors.append(f"'{key}': hay ajustes repetidos")
            seen.add(norm(x))
    if not 10 <= len(out.followUp.strip()) <= 400:
        errors.append("Falta 'followUp' (cómo hacer seguimiento, 10 a 400 caracteres)")
    text = " ".join([*out.curricular, *out.didactic, *out.evaluative, out.followUp])
    if text.strip() and not looks_spanish(text):
        errors.append("Los ajustes no parecen estar en español")
    return errors


def generate_piar(llm: LLM, request: PiarRequest) -> StructuredResult[PiarOut]:
    result = run_structured(
        llm,
        build_piar_messages(request),
        PiarOut,
        lambda out: validate_piar(out, request),
        max_tokens=900,
    )
    clean = PiarOut(
        curricular=[x.strip() for x in result.value.curricular if x.strip()],
        didactic=[x.strip() for x in result.value.didactic if x.strip()],
        evaluative=[x.strip() for x in result.value.evaluative if x.strip()],
        followUp=result.value.followUp.strip(),
    )
    return replace(result, value=clean)
