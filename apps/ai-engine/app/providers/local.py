"""Proveedor local con modelos open-source ejecutados en CPU vía FastEmbed/ONNX (ADR-0006)."""

from functools import cached_property
from pathlib import Path

from .base import Kind, SparseVector


class LocalProvider:
    name = "local"

    def __init__(
        self,
        dense_model: str,
        sparse_model: str,
        rerank_model: str | None = None,
        cache_dir: Path | None = None,
    ):
        self.dense_model = dense_model
        self.sparse_model = sparse_model
        self.rerank_model = rerank_model
        self.cache_dir = str(cache_dir) if cache_dir else None
        self.rerank_enabled = bool(rerank_model)

    # Los modelos se cargan al primer uso: arrancar el servicio no descarga nada.
    @cached_property
    def _dense(self):
        from fastembed import TextEmbedding

        return TextEmbedding(self.dense_model, cache_dir=self.cache_dir)

    @cached_property
    def _sparse(self):
        from fastembed import SparseTextEmbedding

        return SparseTextEmbedding(self.sparse_model, cache_dir=self.cache_dir)

    @cached_property
    def _reranker(self):
        from fastembed.rerank.cross_encoder import TextCrossEncoder

        return TextCrossEncoder(self.rerank_model, cache_dir=self.cache_dir)

    @cached_property
    def dense_dim(self) -> int:
        return len(self.embed(["dimensión"], "query")[0])

    def embed(self, texts: list[str], kind: Kind) -> list[list[float]]:
        model = self._dense
        vectors = model.query_embed(texts) if kind == "query" else model.passage_embed(texts)
        return [v.tolist() for v in vectors]

    def embed_sparse(self, texts: list[str], kind: Kind) -> list[SparseVector]:
        model = self._sparse
        vectors = model.query_embed(texts) if kind == "query" else model.passage_embed(texts)
        return [SparseVector(indices=v.indices.tolist(), values=v.values.tolist()) for v in vectors]

    def rerank(self, query: str, documents: list[str]) -> list[float] | None:
        if not self.rerank_model:
            return None
        return list(self._reranker.rerank(query, documents))
