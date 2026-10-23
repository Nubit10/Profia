"""Proveedor determinista para tests y CI: no descarga modelos (CA-0005-06).

Usa hashing de palabras, así que la búsqueda es léxica pero real: los tests ejercitan filtros,
fusión y contrato con resultados predecibles.
"""

import hashlib
import math
from collections import Counter

from .base import Kind, SparseVector
from .text import tokens

DIM = 256


def _bucket(token: str, size: int) -> int:
    return int.from_bytes(hashlib.sha1(token.encode()).digest()[:4], "big") % size  # noqa: S324


class MockAIProvider:
    name = "mock"
    dense_model = "mock-hashing"
    dense_dim = DIM
    rerank_enabled = False

    def embed(self, texts: list[str], kind: Kind) -> list[list[float]]:
        vectors = []
        for text in texts:
            vec = [0.0] * DIM
            for token in tokens(text):
                vec[_bucket(token, DIM)] += 1.0
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            vectors.append([v / norm for v in vec])
        return vectors

    def embed_sparse(self, texts: list[str], kind: Kind) -> list[SparseVector]:
        out = []
        for text in texts:
            counts = Counter(_bucket(t, 2**20) for t in tokens(text))
            indices = sorted(counts)
            out.append(SparseVector(indices=indices, values=[float(counts[i]) for i in indices]))
        return out

    def rerank(self, query: str, documents: list[str]) -> list[float] | None:
        return None
