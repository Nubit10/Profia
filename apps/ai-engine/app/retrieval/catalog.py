"""Lee el catálogo curricular desde los archivos versionados del repositorio (ADR-0005)."""

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

GRADES = [
    "JARDIN",
    "TRANSICION",
    "G1",
    "G2",
    "G3",
    "G4",
    "G5",
    "G6",
    "G7",
    "G8",
    "G9",
    "G10",
    "G11",
]


@dataclass(frozen=True)
class CatalogItem:
    code: str
    area: str
    grades: tuple[str, ...]
    source_key: str
    text: str


def _grades_of(item: dict) -> tuple[str, ...]:
    if item.get("grade"):
        return (item["grade"],)
    start, end = GRADES.index(item["gradeFrom"]), GRADES.index(item["gradeTo"])
    return tuple(GRADES[start : end + 1])  # un estándar aplica a su rango (SPEC-0004 RN-06)


def load_catalog(directory: Path) -> tuple[list[CatalogItem], str]:
    """Devuelve los ítems y la versión del catálogo (hash del contenido de los archivos)."""
    files = sorted(directory.glob("*.json"))
    if not files:
        raise FileNotFoundError(f"No hay archivos de catálogo en {directory}")
    digest = hashlib.sha256()
    items: list[CatalogItem] = []
    for path in files:
        raw = path.read_bytes()
        digest.update(path.name.encode() + b"\0" + raw)
        document = json.loads(raw)
        source_key = document["source"]["key"]
        for item in document["items"]:
            items.append(
                CatalogItem(
                    code=item["code"],
                    area=item["area"],
                    grades=_grades_of(item),
                    source_key=source_key,
                    # Un fragmento por ítem: enunciado + evidencias (SPEC-0005 §2).
                    text=" ".join([item["statement"], *item["evidences"]]),
                )
            )
    return items, digest.hexdigest()[:16]
