"""Análisis del formato propio del docente (SPEC-0010).

Recibe solo etiquetas del encabezado y títulos de secciones, nunca los valores escritos en el
formato (RN-02), y propone de dónde sale cada dato y qué tipo de sección es cada una. El docente
revisa la propuesta antes de guardarla (RN-01).
"""

import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from ..config import ENGINE_DIR
from ..providers.llm import DATA_END, DATA_START, LLM, Message
from .pipeline import StructuredResult, looks_spanish, norm, run_structured

FORMAT_PROMPT_VERSION = "format_analysis.v1"
FORMAT_PROMPT = (ENGINE_DIR / "prompts" / f"{FORMAT_PROMPT_VERSION}.md").read_text(encoding="utf8")

Source = Literal[
    "INSTITUTION", "CAMPUS", "TEACHER", "SUBJECT", "GRADE", "GROUP", "GRADE_GROUP",
    "PERIOD", "TOPIC", "YEAR", "DATE", "TITLE", "BLANK",
]  # fmt: skip
SectionKind = Literal["ACTIVITIES", "TEXT", "FIXED"]


class SectionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=120)
    # Si la sección trae texto en el formato (sin enviarlo): solo así puede ser "fija".
    hasBody: bool = False  # noqa: N815


class FormatRequest(BaseModel):
    """`extra="forbid"`: no hay campo para valores, nombres ni texto de las secciones (RN-02)."""

    model_config = ConfigDict(extra="forbid")
    headerLabels: list[str] = Field(default_factory=list, max_length=16)  # noqa: N815
    sections: list[SectionIn] = Field(min_length=1, max_length=10)


class HeaderFieldOut(BaseModel):
    label: str
    source: Source


class SectionOut(BaseModel):
    title: str
    kind: SectionKind
    purpose: str = ""


class FormatOut(BaseModel):
    header: list[HeaderFieldOut]
    sections: list[SectionOut]


def build_format_messages(request: FormatRequest) -> list[Message]:
    data = {
        "tarea": "formato",
        "encabezado": request.headerLabels,
        "secciones": [{"titulo": s.title, "tieneTexto": s.hasBody} for s in request.sections],
    }
    user = (
        "Propón el origen de cada campo del encabezado y el tipo de cada sección.\n"
        f"{DATA_START}\n{json.dumps(data, ensure_ascii=False)}\n{DATA_END}\n"
        "Responde solo con el JSON pedido."
    )
    return [Message("system", FORMAT_PROMPT), Message("user", user)]


def validate_format(out: FormatOut, request: FormatRequest) -> list[str]:
    errors: list[str] = []
    if [norm(h.label) for h in out.header] != [norm(label) for label in request.headerLabels]:
        errors.append("'header' debe traer las mismas etiquetas, en el mismo orden")
    if [norm(s.title) for s in out.sections] != [norm(s.title) for s in request.sections]:
        errors.append("'sections' debe traer los mismos títulos, en el mismo orden")
        return errors
    if not any(s.kind == "ACTIVITIES" for s in out.sections):
        errors.append("Debe haber al menos una sección ACTIVITIES")
    for i, (got, asked) in enumerate(zip(out.sections, request.sections, strict=True), start=1):
        if got.kind == "FIXED" and not asked.hasBody:
            errors.append(f"Sección {i}: solo puede ser FIXED si tieneTexto es true")
        if got.kind != "FIXED":
            purpose = got.purpose.strip()
            if not 5 <= len(purpose) <= 200:
                errors.append(f"Sección {i}: 'purpose' debe tener entre 5 y 200 caracteres")
            elif not looks_spanish(purpose):
                errors.append(f"Sección {i}: 'purpose' no parece estar en español")
    return errors


def analyze_format(llm: LLM, request: FormatRequest) -> StructuredResult[FormatOut]:
    result = run_structured(
        llm,
        build_format_messages(request),
        FormatOut,
        lambda out: validate_format(out, request),
        max_tokens=250 + 40 * len(request.headerLabels) + 80 * len(request.sections),
    )
    # Etiquetas y títulos con la ortografía del docente, no la del modelo.
    value = FormatOut(
        header=[
            HeaderFieldOut(label=label, source=h.source)
            for label, h in zip(request.headerLabels, result.value.header, strict=True)
        ],
        sections=[
            SectionOut(title=asked.title, kind=s.kind, purpose=s.purpose.strip())
            for asked, s in zip(request.sections, result.value.sections, strict=True)
        ],
    )
    return StructuredResult(
        value=value,
        provider=result.provider,
        model=result.model,
        attempts=result.attempts,
        latency_ms=result.latency_ms,
        tokens=result.tokens,
    )
