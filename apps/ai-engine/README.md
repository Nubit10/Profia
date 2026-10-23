# AI Engine

Servicio FastAPI/Python separado del producto (ADR-0001). Ofrece:

- **Retrieval curricular** (SPEC-0005): búsqueda híbrida (densa + BM25, fusión RRF) sobre el catálogo oficial del MEN, con filtros de área y grado.
- **Generación estructurada** (SPEC-0007): sugerencia de objetivos de aprendizaje con salida validada (schema + validador pedagógico + reparación). Cadena de LLM por configuración: Groq (gratis) → Ollama local; vLLM propio cuando llegue la Etapa 2 (ADR-0007).

- Contratos: [retrieval-curriculum.v1](../../docs/ai/contracts/retrieval-curriculum.v1.md) · [generation-objective-suggestions.v1](../../docs/ai/contracts/generation-objective-suggestions.v1.md) · [generation-resources.v1](../../docs/ai/contracts/generation-resources.v1.md) (quiz, taller, regenerar un ítem) · [format-analysis.v1](../../docs/ai/contracts/format-analysis.v1.md) (formato propio del docente)
- Estrategia de LLM y costos: [ADR-0007](../../docs/adr/0007-estrategia-de-inferencia-generativa.md)
- Decisiones de modelos y licencias: [ADR-0006](../../docs/adr/0006-stack-inicial-rag.md)

## Requisitos

- [uv](https://docs.astral.sh/uv/) (instala Python 3.12 por su cuenta). Si no está en el PATH: `python -m pip install --user uv` y usar `python -m uv`.
- Docker para Qdrant (`docker compose up -d qdrant` desde la raíz).

## Puesta en marcha

```bash
cd apps/ai-engine
cp .env.example .env            # y genera AI_ENGINE_TOKEN (el mismo en apps/web/.env)
uv sync
uv run python -m app.cli index  # primera vez descarga el modelo (~0,2–1 GB) y luego indexa
uv run uvicorn app.main:app --port 8100
```

## Comandos

| Comando                                                | Qué hace                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `uv run python -m app.cli index`                       | Reindexa el catálogo (`apps/web/curriculum/men`) en Qdrant   |
| `uv run python -m app.cli benchmark`                   | recall@5, recall@1 y latencia con el modelo configurado      |
| `uv run python -m app.cli benchmark --dense <modelo>`  | Compara otro modelo denso (no toca el índice real)           |
| `uv run python -m app.cli benchmark --mock`            | Benchmark con el proveedor de prueba                         |
| `uv run python -m app.cli benchmark-generation`        | Tasa de salidas válidas y latencia de la cadena de LLM       |
| `uv run python -m app.cli benchmark-generation --mock` | Igual, con el LLM de prueba                                  |
| `uv run python -m app.cli benchmark-resources`         | Quices y talleres: válidos, intentos, latencia y tokens      |
| `uv run pytest`                                        | Tests (proveedor de prueba + Qdrant en memoria, sin modelos) |
| `uv run ruff check . && uv run ruff format --check .`  | Lint y formato                                               |

Cambiar de modelo: editar `DENSE_MODEL` en `.env`, reindexar y correr el benchmark. Los resultados quedan en `benchmarks/results/` (RN-06).

## LLM en desarrollo

Instala [Ollama](https://ollama.com/) y descarga el modelo pequeño: `ollama pull qwen3:1.7b`. En CPU tarda ~1 minuto por sugerencia: sirve para desarrollar y como respaldo. Para el uso real, crea una clave gratuita en Groq y ponla en `GROQ_API_KEY`.

## Estructura

```
app/api/        FastAPI: /health y /v1/retrieval/curriculum
app/providers/  AIProvider (embeddings) y LLM: OpenAICompatibleLLM, LLMChain, MockLLM
app/generation/ pipeline estructurado (pipeline.py), objetivos (objectives.py), quiz/taller/ítem (resources.py), análisis de formatos (formats.py)
prompts/        prompts versionados (el nombre del archivo es la versión)
app/retrieval/  lectura del catálogo, indexación y búsqueda híbrida en Qdrant
app/cli.py      index y benchmark
benchmarks/     consultas de docentes con el DBA esperado y resultados versionados
```
