"""Indexación del catálogo en Qdrant: vector denso + disperso por ítem (CA-0005-01)."""

import uuid

from qdrant_client import QdrantClient, models

from ..providers import AIProvider
from .catalog import CatalogItem

DENSE = "dense"
SPARSE = "bm25"
NAMESPACE = uuid.UUID("6f1c2f5e-2b1e-4c55-9a3e-5d1a0b7c9e11")
BATCH = 32


def point_id(code: str) -> str:
    return str(uuid.uuid5(NAMESPACE, code))


def build_index(
    client: QdrantClient,
    provider: AIProvider,
    collection: str,
    items: list[CatalogItem],
    catalog_version: str,
) -> int:
    """Recrea la colección e indexa todos los ítems. Devuelve la cantidad de puntos."""
    if client.collection_exists(collection):
        client.delete_collection(collection)
    client.create_collection(
        collection,
        vectors_config={
            DENSE: models.VectorParams(size=provider.dense_dim, distance=models.Distance.COSINE)
        },
        sparse_vectors_config={SPARSE: models.SparseVectorParams(modifier=models.Modifier.IDF)},
    )
    for field in ("area", "grades"):
        client.create_payload_index(collection, field, models.PayloadSchemaType.KEYWORD)

    for start in range(0, len(items), BATCH):
        chunk = items[start : start + BATCH]
        texts = [i.text for i in chunk]
        dense = provider.embed(texts, "passage")
        sparse = provider.embed_sparse(texts, "passage")
        client.upsert(
            collection,
            points=[
                models.PointStruct(
                    id=point_id(item.code),
                    vector={
                        DENSE: dense_vec,
                        SPARSE: models.SparseVector(indices=sp.indices, values=sp.values),
                    },
                    payload={
                        "code": item.code,
                        "area": item.area,
                        "grades": list(item.grades),
                        "source_key": item.source_key,
                        "text": item.text,
                        "catalog_version": catalog_version,
                        "dense_model": provider.dense_model,
                    },
                )
                for item, dense_vec, sp in zip(chunk, dense, sparse, strict=True)
            ],
        )
    return client.count(collection, exact=True).count


def index_info(client: QdrantClient, collection: str) -> dict:
    if not client.collection_exists(collection):
        return {"points": 0, "catalogVersion": None, "denseModel": None}
    points, _ = client.scroll(collection, limit=1, with_payload=True)
    payload = points[0].payload if points else {}
    return {
        "points": client.count(collection, exact=True).count,
        "catalogVersion": payload.get("catalog_version"),
        "denseModel": payload.get("dense_model"),
    }
