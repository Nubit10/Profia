"""Referentes que no son DBA en los pedidos de generación (SPEC-0039, ADR-0022).

El producto manda los referentes del curso en `dba`; un Estándar o una Orientación del MEN lleva
`kind` (campo opcional y aditivo en todos los contratos). Al modelo le llegan con «tipo», y solo
entonces se agrega el anexo `referentes.v1` al prompt y a la versión registrada: un pedido con solo
DBA es idéntico al de antes.
"""

from typing import Literal

from ..config import ENGINE_DIR

REFERENCES_PROMPT_VERSION = "referentes.v1"
REFERENCES_ANNEX = (ENGINE_DIR / "prompts" / f"{REFERENCES_PROMPT_VERSION}.md").read_text(
    encoding="utf8"
)

ReferenceKind = Literal["STANDARD", "ORIENTATION"]
KIND_LABELS: dict[str, str] = {"STANDARD": "Estándar", "ORIENTATION": "Orientación del MEN"}


def ref_entry(ref) -> dict:
    """Un referente como dato para el modelo; «tipo» solo si no es DBA."""
    entry = {"codigo": ref.code, "enunciado": ref.statement, "evidencias": ref.evidences}
    kind = getattr(ref, "kind", None)
    if kind:
        entry["tipo"] = KIND_LABELS[kind]
    return entry


def has_other_references(refs) -> bool:
    return any(getattr(r, "kind", None) for r in refs or [])


def with_references_version(version: str, refs) -> str:
    return f"{version}+{REFERENCES_PROMPT_VERSION}" if has_other_references(refs) else version


def references_system(system: str, data: dict) -> str:
    """El prompt de sistema con el anexo si algún referente de los datos trae «tipo»."""
    if any("tipo" in d for d in data.get("dba") or []):
        return f"{system}\n\n{REFERENCES_ANNEX}"
    return system
