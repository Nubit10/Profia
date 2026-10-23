# ADR-0006 — Stack inicial de RAG (provisional hasta el benchmark)

| Campo              | Valor        |
| ------------------ | ------------ |
| Estado             | **Aceptado** |
| Fecha              | 2026-10-01   |
| Specs relacionadas | SPEC-0005    |

## Contexto

La Fase 3 incluye el "primer RAG" sobre el catálogo curricular, pero la elección definitiva de modelos depende del benchmark de la Fase 0, que aún no existe. El plan exige modelos open-source autoalojados, Qdrant y búsqueda híbrida con reranking, todo en el AI Engine (Python), detrás de una abstracción de proveedor.

## Decisión

- **Dónde vive:** `apps/ai-engine` (FastAPI), con la primera versión de `AIProvider` limitada a `embed()` y `rerank()`. `generate()` y `stream()` llegan en la Fase 5.
- **Vector DB:** Qdrant en Docker Compose, con vectores densos y dispersos (híbrido) en la misma colección.
- **Embeddings densos (provisional):** `intfloat/multilingual-e5-base`, multilingüe y apto para CPU.
- **Dispersos:** BM25 de Qdrant/FastEmbed, que funciona bien con términos curriculares exactos.
- **Reranker (provisional):** `BAAI/bge-reranker-v2-m3`, multilingüe.
- **Ejecución:** CPU por defecto. El catálogo oficial cabe en unos pocos miles de fragmentos; no hace falta GPU para esta fase.
- **Benchmark mínimo** versionado en `apps/ai-engine/benchmarks/curriculum-retrieval.jsonl`: preguntas de docentes con el DBA esperado. Cambiar de modelo exige comparar contra ese conjunto (plan maestro §20).
- **Entorno Python:** uv, Ruff y pytest (ADR-0002).

## Alternativas consideradas

- **Embeddings con Ollama:** sirve para desarrollo, pero no ofrece reranker y acopla la Fase 3 a Ollama.
- **pgvector en PostgreSQL:** una pieza menos, pero el plan ya fija Qdrant, y la búsqueda híbrida con reranking es más directa en Qdrant.
- **Modelos más grandes (bge-m3, e5-large):** más calidad, pero más lentos en CPU. Se evalúan con el benchmark.

## Ajuste al implementar (2026-10-01)

Los modelos se ejecutan con **FastEmbed (ONNX Runtime)**: más rápido en CPU y sin PyTorch (más de 2 GB). FastEmbed no incluye `multilingual-e5-base` ni `bge-reranker-v2-m3`, así que:

- **Denso por defecto:** `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (768 dimensiones, Apache-2.0). El benchmark lo compara con `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensiones, Apache-2.0, más rápido).
- **Disperso:** `Qdrant/bm25`, fusionado con el denso por RRF en Qdrant.
- **Reranker desactivado por defecto.** El único multilingüe disponible en FastEmbed, `jinaai/jina-reranker-v2-base-multilingual`, tiene licencia **CC-BY-NC-4.0 (no comercial)** y no se puede usar en producción. La etapa `rerank()` existe en el pipeline y se activa por configuración cuando haya uno con licencia comercial (p. ej. `bge-reranker-v2-m3` en un servidor con PyTorch o GPU).

Toda licencia de modelo se verifica antes de adoptarlo: el producto es comercial.

## Restricción de hardware (2026-10-01)

El equipo de desarrollo no tiene GPU. Embeddings y reranking corren en CPU. Para la Fase 5 (generación), un LLM de buen tamaño **no** correrá bien en ese equipo: se necesitará un servidor con GPU para vLLM, o modelos pequeños vía Ollama solo para desarrollo. Esa decisión irá en el ADR de la Fase 5.

## Consecuencias

- Los nombres de los modelos van en configuración, no en el código del dominio. Cambiarlos es editar la configuración, reindexar y comparar contra el benchmark.
- Se agregan dos servicios al Docker Compose de desarrollo: `qdrant` y `ai-engine`.
- Este ADR se reemplaza cuando el benchmark de la Fase 0 elija los modelos definitivos.
