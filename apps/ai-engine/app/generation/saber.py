"""Preguntas tipo Saber (ICFES) con situación, figura y competencia (SPEC-0023, ADR-0018).

La IA escribe la situación, elige la competencia del catálogo y describe la figura como **datos**;
aquí se valida. El dibujo lo hace el producto (`apps/web/lib/figures`).
"""

import json
from functools import cache
from pathlib import Path
from typing import Annotated, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field

from .pipeline import norm, words

SABER_PROMPT_VERSION = "saber.v1"
CATALOG = Path(__file__).parent / "data" / "saber_competencias.v1.json"
Area = Literal["MATEMATICAS", "LENGUAJE"]

CONTEXT_WORDS = {"MATEMATICAS": (15, 150), "LENGUAJE": (15, 250)}
MIN_COMPETENCIES = 2
MIN_QUESTIONS_FOR_VARIETY = 3
LABEL = Annotated[str, Field(max_length=40)]


@cache
def competencies() -> dict[str, list[str]]:
    return json.loads(CATALOG.read_text(encoding="utf8"))["areas"]


def saber_area(subject: str) -> Area | None:
    """RN-01: Matemáticas o Lenguaje (también "Lengua Castellana" o "Español")."""
    text = norm(subject)
    if "matematic" in text:
        return "MATEMATICAS"
    if any(k in text for k in ("lenguaje", "castellan", "espanol", "lectura")):
        return "LENGUAJE"
    return None


# --- Figuras (RN-04): datos, nunca imágenes ---------------------------------------------------


class Mark(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: float
    label: LABEL = ""


class NumberLine(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["NUMBER_LINE"]
    min: float
    max: float
    step: float
    marks: list[Mark] = Field(default_factory=list, max_length=6)


class BarChart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["BAR_CHART"]
    title: str = Field(default="", max_length=80)
    categories: list[LABEL] = Field(max_length=8)
    values: list[float] = Field(max_length=8)
    unit: str = Field(default="", max_length=20)


class Table(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["TABLE"]
    headers: list[LABEL] = Field(max_length=5)
    rows: list[list[LABEL]] = Field(max_length=8)


class FractionModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["FRACTION"]
    numerator: int
    denominator: int
    shape: Literal["CIRCLE", "BAR"] = "BAR"


class Rectangle(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["RECTANGLE"]
    width: float
    height: float
    unit: str = Field(default="", max_length=10)


Figure = Annotated[
    NumberLine | BarChart | Table | FractionModel | Rectangle, Field(discriminator="kind")
]


def figure_errors(figure: BaseModel, label: str) -> list[str]:
    """RN-04: una figura inválida es un error de estructura con el motivo."""
    errors: list[str] = []
    if isinstance(figure, NumberLine):
        if figure.step <= 0 or figure.max <= figure.min:
            errors.append(f"{label}: la recta necesita min < max y step > 0")
        else:
            ticks = (figure.max - figure.min) / figure.step
            if not 2 <= ticks <= 40:
                errors.append(f"{label}: la recta debe tener entre 2 y 40 marcas (tiene {ticks:g})")
            outside = [m.value for m in figure.marks if not figure.min <= m.value <= figure.max]
            if outside:
                values = ", ".join(f"{v:g}" for v in outside)
                errors.append(f"{label}: los puntos {values} están fuera de la recta")
    elif isinstance(figure, BarChart):
        if not 2 <= len(figure.categories) <= 8:
            errors.append(f"{label}: la gráfica de barras necesita entre 2 y 8 categorías")
        if len(figure.values) != len(figure.categories):
            errors.append(f"{label}: cada categoría necesita su valor")
        if any(v < 0 or v > 1_000_000 for v in figure.values):
            errors.append(f"{label}: los valores de las barras van de 0 a 1.000.000")
    elif isinstance(figure, Table):
        if not 2 <= len(figure.headers) <= 5:
            errors.append(f"{label}: la tabla necesita entre 2 y 5 columnas")
        if not 1 <= len(figure.rows) <= 8:
            errors.append(f"{label}: la tabla necesita entre 1 y 8 filas")
        if any(len(r) != len(figure.headers) for r in figure.rows):
            errors.append(
                f"{label}: todas las filas de la tabla deben tener {len(figure.headers)} celdas"
            )
    elif isinstance(figure, FractionModel):
        if not 2 <= figure.denominator <= 12 or not 0 <= figure.numerator <= figure.denominator:
            errors.append(f"{label}: la fracción va de 0/d a d/d con d entre 2 y 12")
    elif isinstance(figure, Rectangle) and not (
        0 < figure.width <= 1000 and 0 < figure.height <= 1000
    ):
        errors.append(f"{label}: el rectángulo necesita lados entre 0 y 1000")
    return errors


# --- Preguntas -------------------------------------------------------------------------------


class SaberQuestion(Protocol):
    type: str
    context: str | None
    competency: str | None
    figure: BaseModel | None


def saber_errors(questions: list[SaberQuestion], subject: str, labels: list[str]) -> list[str]:
    """RN-03 y RN-04: errores de estructura de las preguntas de selección múltiple."""
    area = saber_area(subject)
    if area is None:
        return []
    allowed = {norm(c) for c in competencies()[area]}
    low, high = CONTEXT_WORDS[area]
    errors: list[str] = []
    for q, label in zip(questions, labels, strict=True):
        if q.type != "MULTIPLE_CHOICE":
            continue
        count = len(words(q.context or ""))
        if not low <= count <= high:
            errors.append(
                f"{label}: 'context' debe tener entre {low} y {high} palabras (tiene {count})"
            )
        if norm(q.competency or "") not in allowed:
            errors.append(
                f"{label}: 'competency' debe ser exactamente una de: "
                + " · ".join(competencies()[area])
            )
        if q.figure is not None:
            if area != "MATEMATICAS":
                errors.append(f"{label}: en Lenguaje no van figuras; quita 'figure'")
            else:
                errors += figure_errors(q.figure, label)
    return errors


def saber_quality(questions: list[SaberQuestion], subject: str) -> list[str]:
    """RN-03: con 3 o más preguntas, al menos 2 competencias distintas (error de calidad)."""
    if saber_area(subject) is None:
        return []
    mc = [q for q in questions if q.type == "MULTIPLE_CHOICE"]
    used = {norm(q.competency or "") for q in mc if q.competency}
    if len(mc) >= MIN_QUESTIONS_FOR_VARIETY and len(used) < MIN_COMPETENCIES:
        return ["Usa al menos 2 competencias distintas entre las preguntas de selección múltiple"]
    return []


def canonical_competency(value: str | None, subject: str) -> str | None:
    """La competencia con la ortografía del catálogo."""
    area = saber_area(subject)
    if not value or area is None:
        return None
    return next((c for c in competencies()[area] if norm(c) == norm(value)), None)


def clean_saber[Q](q: Q, saber: bool, subject: str) -> Q:
    """Sin estilo Saber o fuera de selección múltiple: sin situación, competencia ni figura."""
    if not saber or q.type != "MULTIPLE_CHOICE":  # type: ignore[attr-defined]
        return q.model_copy(update={"context": None, "competency": None, "figure": None})  # type: ignore[attr-defined]
    return q.model_copy(  # type: ignore[attr-defined]
        update={
            "context": (q.context or "").strip(),  # type: ignore[attr-defined]
            "competency": canonical_competency(q.competency, subject),  # type: ignore[attr-defined]
        }
    )
