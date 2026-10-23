"""Búsqueda híbrida (densa + BM25, fusión RRF) con filtros previos de área y grado (RN-03)."""

from dataclasses import dataclass

from qdrant_client import QdrantClient, models

from ..providers import AIProvider
from .index import DENSE, SPARSE

CANDIDATES_PER_RETRIEVER = 40


@dataclass(frozen=True)
class Hit:
    code: str
    score: float


def _filter(area: str | None, grade: str | None) -> models.Filter | None:
    must: list[models.Condition] = []
    if area:
        must.append(models.FieldCondition(key="area", match=models.MatchValue(value=area)))
    if grade:
        must.append(models.FieldCondition(key="grades", match=models.MatchValue(value=grade)))
    return models.Filter(must=must) if must else None


def search_curriculum(
    client: QdrantClient,
    provider: AIProvider,
    collection: str,
    query: str,
    *,
    area: str | None = None,
    grade: str | None = None,
    limit: int = 8,
) -> list[Hit]:
    """La consulta es solo texto de búsqueda: nunca se interpreta como instrucción (RN-04)."""
    flt = _filter(area, grade)
    dense = provider.embed([query], "query")[0]
    sparse = provider.embed_sparse([query], "query")[0]
    pool = max(CANDIDATES_PER_RETRIEVER, limit * 4)

    # Los filtros van dentro de cada prefetch: se aplican antes del ranking.
    response = client.query_points(
        collection,
        prefetch=[
            models.Prefetch(query=dense, using=DENSE, filter=flt, limit=pool),
            models.Prefetch(
                query=models.SparseVector(indices=sparse.indices, values=sparse.values),
                using=SPARSE,
                filter=flt,
                limit=pool,
            ),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        query_filter=flt,
        limit=pool if provider.rerank_enabled else limit,
        with_payload=["code", "text"],
    )
    points = response.points

    if provider.rerank_enabled and points:
        scores = provider.rerank(query, [p.payload["text"] for p in points]) or []
        ranked = sorted(zip(points, scores, strict=True), key=lambda pair: pair[1], reverse=True)
        return [Hit(code=p.payload["code"], score=float(s)) for p, s in ranked[:limit]]
    return [Hit(code=p.payload["code"], score=float(p.score)) for p in points[:limit]]
