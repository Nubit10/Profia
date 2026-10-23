"""Abstracción de proveedor de IA (plan maestro §7.1). En esta fase: embed y rerank.

generate() y stream() llegan en la Fase 5. El dominio nunca depende de un proveedor concreto.
"""

from dataclasses import dataclass
from typing import Literal, Protocol

Kind = Literal["query", "passage"]


@dataclass(frozen=True)
class SparseVector:
    indices: list[int]
    values: list[float]


class AIProvider(Protocol):
    name: str
    dense_model: str
    dense_dim: int
    rerank_enabled: bool

    def embed(self, texts: list[str], kind: Kind) -> list[list[float]]:
        """Vectores densos normalizados."""
        ...

    def embed_sparse(self, texts: list[str], kind: Kind) -> list[SparseVector]:
        """Vectores dispersos (léxicos, p. ej. BM25)."""
        ...

    def rerank(self, query: str, documents: list[str]) -> list[float] | None:
        """Puntajes de relevancia por documento, o None si el reranking está desactivado."""
        ...
