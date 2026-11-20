"""Verificación de las respuestas de Matemáticas (SPEC-0022, ADR-0017).

El modelo escribe el cálculo de cada respuesta numérica (`check`); este módulo lo evalúa de forma
exacta (fracciones) y segura: analiza el texto con `ast` y recorre el árbol con una lista blanca.
**Nunca** usa `eval`, `exec` ni librerías que lo usen por dentro.
"""

import ast
import math
import re
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .pipeline import norm

MATH_CHECK_VERSION = "math_check.v1"
MAX_EXPRESSION = 120
MAX_EXPONENT = 6
MAX_ABS = 10**12

Status = Literal["VERIFIED", "CORRECTED", "REVIEW"]


class MathCheck(BaseModel):
    """Cálculo que el modelo escribe para una respuesta numérica (RN-02)."""

    model_config = ConfigDict(extra="forbid")
    expression: str | None = Field(default=None, max_length=200)
    equation: str | None = Field(default=None, max_length=200)
    variable: str | None = Field(default=None, max_length=3)

    @model_validator(mode="after")
    def _one_kind(self):
        if (self.expression is None) == (self.equation is None):
            raise ValueError("'check' lleva 'expression' o 'equation', no ambas")
        return self


class AnswerCheck(BaseModel):
    """Estado de la verificación que ve el docente (RN-07)."""

    model_config = ConfigDict(extra="forbid")
    status: Status
    note: str = Field(default="", max_length=200)


class CheckError(ValueError):
    """El cálculo no es válido o no se puede evaluar con seguridad."""


def is_math(subject: str) -> bool:
    """RN-01: asignaturas de Matemáticas (sin importar tildes ni mayúsculas)."""
    return "matematic" in norm(subject)


# --- Evaluador -------------------------------------------------------------------------------


def _prepare(text: str) -> str:
    out = text.strip()
    for a, b in (("−", "-"), ("–", "-"), ("×", "*"), ("·", "*"), ("÷", "/"), ("^", "**")):
        out = out.replace(a, b)
    out = re.sub(r"(\d),(\d)", r"\1.\2", out)  # coma decimal
    out = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"(\1/100)", out)  # porcentaje
    out = re.sub(r"(\d)\s*([a-zA-Z(])", r"\1*\2", out)  # 2x · 3(…)
    out = re.sub(r"\)\s*\(", ")*(", out)
    return out


def _bounded(value: Fraction) -> Fraction:
    if abs(value) >= MAX_ABS or value.denominator >= MAX_ABS:
        raise CheckError("el resultado es demasiado grande")
    return value


def _sqrt(value: Fraction) -> Fraction:
    if value < 0:
        raise CheckError("raíz de un número negativo")
    num, den = math.isqrt(value.numerator), math.isqrt(value.denominator)
    if num * num != value.numerator or den * den != value.denominator:
        raise CheckError("la raíz no es exacta")
    return Fraction(num, den)


def _eval(node: ast.AST, names: dict[str, Fraction]) -> Fraction:
    if isinstance(node, ast.Expression):
        return _eval(node.body, names)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, int | float):
            raise CheckError("solo se admiten números")
        return _bounded(Fraction(str(node.value)))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub | ast.UAdd):
        value = _eval(node.operand, names)
        return -value if isinstance(node.op, ast.USub) else value
    if isinstance(node, ast.BinOp) and isinstance(
        node.op, ast.Add | ast.Sub | ast.Mult | ast.Div | ast.Pow
    ):
        left, right = _eval(node.left, names), _eval(node.right, names)
        if isinstance(node.op, ast.Add):
            return _bounded(left + right)
        if isinstance(node.op, ast.Sub):
            return _bounded(left - right)
        if isinstance(node.op, ast.Mult):
            return _bounded(left * right)
        if isinstance(node.op, ast.Div):
            if right == 0:
                raise CheckError("división por cero")
            return _bounded(left / right)
        if right.denominator != 1 or abs(right) > MAX_EXPONENT:
            raise CheckError(
                f"el exponente debe ser un entero entre -{MAX_EXPONENT} y {MAX_EXPONENT}"
            )
        if left == 0 and right < 0:
            raise CheckError("división por cero")
        return _bounded(left ** int(right))
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "sqrt"
        and len(node.args) == 1
        and not node.keywords
    ):
        return _sqrt(_eval(node.args[0], names))
    if isinstance(node, ast.Name) and node.id in names:
        return names[node.id]
    raise CheckError("el cálculo tiene algo que no es aritmética")


def evaluate(expression: str, names: dict[str, Fraction] | None = None) -> Fraction:
    """Evalúa una expresión aritmética de forma exacta (CA-0022-01)."""
    if len(expression) > MAX_EXPRESSION:
        raise CheckError("el cálculo es demasiado largo")
    try:
        tree = ast.parse(_prepare(expression), mode="eval")
    except SyntaxError as error:
        raise CheckError("el cálculo no se puede leer") from error
    return _eval(tree, names or {})


def solve_linear(equation: str, variable: str) -> Fraction:
    """Resuelve una ecuación lineal de una incógnita (CA-0022-02)."""
    if not re.fullmatch(r"[a-zA-Z]", variable or ""):
        raise CheckError("la incógnita debe ser una letra")
    sides = re.split(r"(?<![<>!=])=(?!=)", equation)
    if len(sides) != 2:
        raise CheckError("la ecuación debe tener un solo '='")
    left, right = sides

    def f(v: Fraction) -> Fraction:
        names = {variable: v}
        return evaluate(left, names) - evaluate(right, names)

    points = [f(Fraction(v)) for v in (-1, 0, 1, 2, 3)]
    slopes = {b - a for a, b in zip(points, points[1:], strict=False)}
    if len(slopes) != 1:
        raise CheckError("la ecuación no es lineal")
    slope = slopes.pop()
    if slope == 0:
        raise CheckError("la ecuación no tiene una única solución")
    return _bounded(-points[1] / slope)


def compute(check: MathCheck) -> Fraction:
    if check.expression is not None:
        return evaluate(check.expression)
    return solve_linear(check.equation or "", check.variable or "")


# --- Comparación con la respuesta ----------------------------------------------------------------

# Número al comienzo de la respuesta: "x = 4", "$ 5.000", "-3 °C", "0,5", "2/3", "25 %".
_PREFIX = r"^\s*(?:[a-zA-Z]\s*=\s*)?\$?\s*"
_NUMBER = (
    r"(?P<sign>[-−]?)\s*(?:(?P<thousands>\d{1,3}(?:\.\d{3})+)(?:,(?P<tdec>\d+))?"
    r"|(?P<int>\d+)(?:[.,](?P<dec>\d+))?)"
    r"(?:\s*/\s*(?P<den>\d+))?\s*(?P<pct>%)?"
)
_ANSWER = re.compile(_PREFIX + _NUMBER)
MAX_NUMERIC_ANSWER = 40


@dataclass(frozen=True)
class Number:
    value: Fraction
    decimals: int
    percent: bool


def parse_number(text: str) -> Number | None:
    """El número de una respuesta numérica, o None si la respuesta no lo es (RN-04)."""
    clean = text.strip()
    if not clean or len(clean) > MAX_NUMERIC_ANSWER:
        return None
    match = _ANSWER.match(clean)
    if not match:
        return None
    sign = -1 if match["sign"] else 1
    if match["thousands"]:
        whole, decimals = match["thousands"].replace(".", ""), match["tdec"] or ""
    else:
        whole, decimals = match["int"], match["dec"] or ""
    value = Fraction(f"{whole}.{decimals}" if decimals else whole) * sign
    if match["den"]:
        if int(match["den"]) == 0 or decimals:
            return None
        value = value / int(match["den"])
    return Number(value=value, decimals=len(decimals), percent=bool(match["pct"]))


def matches(value: Fraction, text: str) -> bool:
    number = parse_number(text)
    if number is None:
        return False
    candidates = [number.value]
    if number.percent:
        candidates.append(number.value / 100)
    for candidate in candidates:
        if candidate == value:
            return True
        # Un decimal redondeado cuenta desde dos cifras: "0,33" sí es 1/3; "0,3" no.
        if number.decimals >= 2:
            scale = 10**number.decimals
            # Redondeo hacia arriba en la mitad y redondeo al par: los dos son comunes.
            up = Fraction(math.floor(value * scale + Fraction(1, 2)), scale)
            if candidate in (up, Fraction(round(value * scale), scale)):
                return True
    return False


def show(value: Fraction) -> str:
    """El número como lo leería un docente: entero, decimal con coma o fracción."""
    if value.denominator == 1:
        return str(value.numerator)
    den = value.denominator
    while den % 2 == 0:
        den //= 2
    while den % 5 == 0:
        den //= 5
    if den == 1 and value.denominator <= 10_000:
        text = f"{float(value):.6f}".rstrip("0").rstrip(".")
        return text.replace(".", ",")
    return f"{value.numerator}/{value.denominator}"


# --- Juicio por pregunta -----------------------------------------------------------------------


class CheckedQuestion(Protocol):
    type: str
    stem: str
    options: list[str]
    answer: str
    check: MathCheck | None
    answerCheck: AnswerCheck | None  # noqa: N815


VERIFIABLE = ("MULTIPLE_CHOICE", "SHORT_ANSWER")


@dataclass
class Verdict:
    kind: Literal["SKIP", "VERIFIED", "MISSING", "INVALID", "MISMATCH", "NOT_NUMERIC"]
    value: Fraction | None = None
    reason: str = ""
    options: list[int] = field(default_factory=list)


def judge(q: CheckedQuestion) -> Verdict:
    if q.type not in VERIFIABLE:
        return Verdict("SKIP")
    numeric = parse_number(q.answer) is not None
    if q.check is None:
        return Verdict("MISSING") if numeric else Verdict("SKIP")
    try:
        value = compute(q.check)
    except CheckError as error:
        return Verdict("INVALID", reason=str(error))
    if q.type == "MULTIPLE_CHOICE":
        hits = [i for i, o in enumerate(q.options) if matches(value, o)]
        answer_ok = matches(value, q.answer)
        if answer_ok and len(hits) == 1:
            return Verdict("VERIFIED", value)
        if answer_ok:
            return Verdict("MISMATCH", value, "dos opciones son correctas", hits)
        return Verdict("MISMATCH", value, "", hits)
    if not numeric:
        return Verdict("NOT_NUMERIC", value)
    return Verdict("VERIFIED", value) if matches(value, q.answer) else Verdict("MISMATCH", value)


def check_errors(questions: list[CheckedQuestion], labels: list[str] | None = None) -> list[str]:
    """RN-05 y RN-06: errores de calidad para la reparación (no tumban la generación)."""
    labels = labels or [f"Pregunta {i}" for i in range(1, len(questions) + 1)]
    errors: list[str] = []
    for q, label in zip(questions, labels, strict=True):
        v = judge(q)
        if v.kind == "MISSING":
            errors.append(
                f"{label}: la respuesta es un número; agrega 'check' con el cálculo que la produce"
            )
        elif v.kind == "INVALID":
            errors.append(f"{label}: el cálculo de 'check' no es válido ({v.reason})")
        elif v.kind == "NOT_NUMERIC":
            errors.append(f"{label}: la respuesta no tiene un número para comparar con el cálculo")
        elif v.kind == "MISMATCH" and v.reason:
            texts = " y ".join(f"«{q.options[i]}»" for i in v.options)
            errors.append(f"{label}: {v.reason} según el cálculo ({show(v.value)}): {texts}")
        elif v.kind == "MISMATCH":
            errors.append(
                f"{label}: el cálculo da {show(v.value)} y la respuesta dice «{q.answer}»; "
                "corrige la respuesta o el cálculo"
            )
    return errors


def finalize[Q](questions: list[Q], labels: list[str] | None = None) -> tuple[list[Q], list[str]]:
    """RN-06 y RN-07: decide `answerCheck`, corrige solo si es inequívoco y quita `check`."""
    labels = labels or [f"Pregunta {i}" for i in range(1, len(questions) + 1)]
    out: list[Q] = []
    warnings: list[str] = []
    for q, label in zip(questions, labels, strict=True):
        v = judge(q)  # type: ignore[arg-type]
        update: dict = {"check": None, "answerCheck": None}
        if v.kind == "VERIFIED":
            update["answerCheck"] = AnswerCheck(
                status="VERIFIED", note=f"El cálculo da {show(v.value)}."
            )
        elif v.kind == "MISMATCH" and not v.reason and len(v.options) == 1:
            option = q.options[v.options[0]]  # type: ignore[attr-defined]
            update["answer"] = option
            update["answerCheck"] = AnswerCheck(
                status="CORRECTED",
                note=f"Se cambió la respuesta: el cálculo da {show(v.value)}.",
            )
            warnings.append(f"{label}: respuesta corregida según el cálculo")
        elif v.kind != "SKIP":
            note = _review_note(v)
            update["answerCheck"] = AnswerCheck(status="REVIEW", note=note[:200])
            warnings.append(f"{label}: respuesta por revisar ({note})")
        out.append(q.model_copy(update=update))  # type: ignore[attr-defined]
    return out, warnings


def _review_note(v: Verdict) -> str:
    if v.kind == "MISSING":
        return "No trae el cálculo para verificarla."
    if v.kind == "INVALID":
        return f"No se pudo verificar: {v.reason}."
    if v.kind == "NOT_NUMERIC" or v.value is None:
        return "No se pudo comparar la respuesta con el cálculo."
    if v.reason:
        return f"Dos opciones dan {show(v.value)}."
    return f"El cálculo da {show(v.value)} y la respuesta es otra."


def strip_checks[Q](questions: list[Q]) -> list[Q]:
    """Fuera de Matemáticas: nada de `check` ni de `answerCheck` (CA-0022-08)."""
    return [q.model_copy(update={"check": None, "answerCheck": None}) for q in questions]  # type: ignore[attr-defined]
