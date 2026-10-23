# AI Engine (SPEC-0005, despliegue en docs/deploy/README.md). Imagen de CPU: FastEmbed/ONNX, sin PyTorch.
# Se construye desde la RAÍZ del repositorio, porque el catálogo vive en apps/web/curriculum/men:
#   docker build -f apps/ai-engine/Dockerfile -t profe-ai-engine .
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH"

COPY apps/ai-engine/pyproject.toml apps/ai-engine/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Los modelos van dentro de la imagen: el servicio arranca sin descargar ~1 GB en cada despliegue.
ARG DENSE_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2
ARG SPARSE_MODEL=Qdrant/bm25
RUN python -c "from fastembed import SparseTextEmbedding, TextEmbedding; \
TextEmbedding('${DENSE_MODEL}', cache_dir='/models'); \
SparseTextEmbedding('${SPARSE_MODEL}', cache_dir='/models')"

COPY apps/ai-engine/app ./app
COPY apps/ai-engine/prompts ./prompts
COPY apps/web/curriculum/men ./catalog

# Sin servidor de Qdrant: el catálogo (cientos de ítems) se indexa en memoria al arrancar.
# Para usar un Qdrant aparte, define QDRANT_URL al desplegar.
ENV MODELS_CACHE_DIR=/models CATALOG_DIR=/app/catalog QDRANT_URL=:memory: \
    DENSE_MODEL=${DENSE_MODEL} SPARSE_MODEL=${SPARSE_MODEL}

# Usuario sin privilegios.
RUN useradd --create-home engine && chown -R engine /models
USER engine

EXPOSE 8100
# Railway, Render y Fly asignan el puerto en $PORT. Sin $PORT (local, Hugging Face con app_port) queda en 8100.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8100}"]
