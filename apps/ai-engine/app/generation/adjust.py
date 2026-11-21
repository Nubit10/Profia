"""Ajustes rápidos con botones (SPEC-0027, ADR-0020).

El docente no escribe: el producto envía un código fijo y, para el recurso completo, la versión
actual.
El significado de cada código vive en el anexo versionado `prompts/adjust.v1.md`.
"""

import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, field_validator

from ..providers.llm import DATA_END, DATA_START, Message

ADJUST_PROMPT_VERSION = "adjust.v1"

ResourceAdjustCode = Literal["EASIER", "HARDER", "SHORTER", "EVERYDAY_EXAMPLES", "ADD_ITEMS"]
ItemAdjustCode = Literal["EASIER", "ANOTHER", "CLEARER"]

# Tamaño máximo de la versión actual (JSON), para no pasarse de tokens.
MAX_CURRENT_CHARS = 40_000


def _annex() -> str:
    from .resources import _prompt

    return _prompt(ADJUST_PROMPT_VERSION)


class ResourceAdjust(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: ResourceAdjustCode
    current: dict[str, Any] | None = None

    @field_validator("current")
    @classmethod
    def _size(cls, value: dict[str, Any] | None):
        if value is not None and len(json.dumps(value, ensure_ascii=False)) > MAX_CURRENT_CHARS:
            raise ValueError("La versión actual es demasiado grande")
        return value


def with_adjust_version(version: str, adjust: object | None) -> str:
    return f"{version}+{ADJUST_PROMPT_VERSION}" if adjust else version


def apply_adjust(messages: list[Message], adjust: ResourceAdjust | str | None) -> list[Message]:
    """Agrega el anexo al sistema y el ajuste a los datos (antes del cierre de datos)."""
    if not adjust:
        return messages
    system, user = messages[0], messages[1]
    if isinstance(adjust, str):
        payload: dict[str, Any] = {"codigo": adjust}
        label = adjust
    else:
        payload = {"codigo": adjust.code, "versionActual": adjust.current}
        label = adjust.code
    # El ajuste va dentro del mismo bloque de datos, como un campo más.
    head, rest = user.content.split(f"{DATA_START}\n", 1)
    raw, tail = rest.split(f"\n{DATA_END}", 1)
    data = json.loads(raw) | {"ajuste": payload}
    content = f"{head}{DATA_START}\n{json.dumps(data, ensure_ascii=False)}\n{DATA_END}{tail}"
    content += f"\nAplica el ajuste {label} (regla AJ-2)."
    return [Message("system", f"{system.content}\n{_annex()}"), Message("user", content)]
