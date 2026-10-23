"""Pipeline de generación estructurada (plan maestro §7, SPEC-0007/0008).

contexto → LLM → schema (Pydantic) → validador pedagógico → reparación con los errores concretos.
Nada inválido sale de aquí: si tras los intentos la salida no cumple, se lanza un error.
"""

import json
import re
import time
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass

from pydantic import BaseModel, ValidationError

from ..providers.llm import LLM, MAX_RATE_LIMIT_WAIT_S, Message

MAX_ATTEMPTS = 3  # 1 intento + 2 reparaciones

SPANISH_HINTS = {
    "de", "la", "el", "en", "los", "las", "y", "con", "para", "del", "un", "una", "que", "su",
    "es", "se", "por", "al", "lo", "como", "cual", "cuanto", "cuantos",
}  # fmt: skip


class GenerationInvalidError(Exception):
    def __init__(self, errors: list[str], attempts: int):
        super().__init__("; ".join(errors))
        self.errors = errors
        self.attempts = attempts


@dataclass(frozen=True)
class StructuredResult[T: BaseModel]:
    value: T
    provider: str
    model: str
    attempts: int
    latency_ms: int
    tokens: int


def norm(text: str) -> str:
    """Minúsculas, sin tildes ni espacios repetidos: para comparar textos."""
    plain = unicodedata.normalize("NFD", text.lower())
    return " ".join("".join(c for c in plain if unicodedata.category(c) != "Mn").split())


def words(text: str) -> list[str]:
    return re.findall(r"[a-zñ]+", norm(text))


def looks_spanish(text: str) -> bool:
    return bool(SPANISH_HINTS & set(words(text)))


def parse_json[T: BaseModel](text: str, schema: type[T]) -> T:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("La respuesta no contiene un objeto JSON")
    return schema.model_validate(json.loads(match.group(0)))


def run_structured[T: BaseModel](
    llm: LLM,
    messages: list[Message],
    schema: type[T],
    validate: Callable[[T], list[str]],
    *,
    max_tokens: int,
    max_wait_s: float = MAX_RATE_LIMIT_WAIT_S,
    normalize: Callable[[T], T] | None = None,
) -> StructuredResult[T]:
    """`normalize` corrige de forma determinista lo que no requiere al modelo (p. ej. preguntas
    de más) antes de validar; lo que no se puede corregir así vuelve al modelo como reparación."""
    started = time.perf_counter()
    errors: list[str] = []
    tokens = 0
    for attempt in range(1, MAX_ATTEMPTS + 1):
        completion = llm.generate(
            messages, json_mode=True, max_tokens=max_tokens, max_wait_s=max_wait_s
        )
        tokens += completion.tokens
        try:
            value = parse_json(completion.text, schema)
            if normalize:
                value = normalize(value)
            errors = validate(value)
        except (ValueError, ValidationError) as error:
            errors = [f"El JSON no tiene la forma pedida: {str(error)[:300]}"]
        if not errors:
            return StructuredResult(
                value=value,
                provider=completion.provider,
                model=completion.model,
                attempts=attempt,
                latency_ms=int((time.perf_counter() - started) * 1000),
                tokens=tokens,
            )
        # Reparación: se le devuelven al modelo sus errores concretos.
        messages = [
            *messages,
            Message("assistant", completion.text[:8000]),
            Message(
                "user",
                "La respuesta anterior no cumple las reglas:\n- "
                + "\n- ".join(errors[:15])
                + "\nCorrígela y responde solo con el JSON completo pedido.",
            ),
        ]
    raise GenerationInvalidError(errors, MAX_ATTEMPTS)
