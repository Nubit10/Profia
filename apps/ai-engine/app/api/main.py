"""API HTTP del AI Engine. Contratos: docs/ai/contracts/."""

import hmac
import logging
import time
from collections.abc import Callable
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient

from ..config import Settings, get_settings
from ..generation.exams import (
    EXAM_ITEM_PROMPT_VERSION,
    EXAM_PROMPT_VERSION,
    ExamItemOut,
    ExamItemRequest,
    ExamOut,
    ExamRequest,
    generate_exam,
    regenerate_exam_item,
)
from ..generation.formats import (
    FORMAT_PROMPT_VERSION,
    FormatOut,
    FormatRequest,
    analyze_format,
)
from ..generation.objectives import (
    PROMPT_VERSION,
    GenerationInvalidError,
    ObjectiveRequest,
    suggest_objectives,
)
from ..generation.pipeline import StructuredResult
from ..generation.resources import (
    ITEM_PROMPT_VERSION,
    QUIZ_PROMPT_VERSION,
    ItemOut,
    ItemRequest,
    QuizOut,
    QuizRequest,
    WorkshopOut,
    WorkshopRequest,
    generate_quiz,
    generate_workshop,
    regenerate_item,
    workshop_prompt_version,
)
from ..providers import AIProvider, LLMChain, LLMUnavailableError, build_llm, build_provider
from ..retrieval.catalog import GRADES, load_catalog
from ..retrieval.index import build_index, index_info
from ..retrieval.search import search_curriculum

log = logging.getLogger("ai_engine")

Grade = Literal[tuple(GRADES)]  # type: ignore[valid-type]


class CurriculumQuery(BaseModel):
    query: str = Field(min_length=3, max_length=300)
    area: str | None = Field(default=None, max_length=40)
    grade: Grade | None = None
    limit: int = Field(default=8, ge=1, le=20)


class CurriculumHit(BaseModel):
    code: str
    score: float


class SearchMeta(BaseModel):
    provider: str
    denseModel: str
    catalogVersion: str | None
    latencyMs: int


class CurriculumResponse(BaseModel):
    results: list[CurriculumHit]
    meta: SearchMeta


class SuggestionOut(BaseModel):
    statement: str
    dbaCodes: list[str]


class GenerationMeta(BaseModel):
    provider: str
    model: str
    promptVersion: str
    attempts: int
    latencyMs: int


class SuggestionsResponse(BaseModel):
    suggestions: list[SuggestionOut]
    meta: GenerationMeta


class ResourceMeta(GenerationMeta):
    tokens: int


class QuizResponse(BaseModel):
    quiz: QuizOut
    meta: ResourceMeta


class WorkshopResponse(BaseModel):
    workshop: WorkshopOut
    meta: ResourceMeta


class ItemResponse(ItemOut):
    meta: ResourceMeta


class FormatResponse(FormatOut):
    meta: ResourceMeta


class ExamCallMeta(BaseModel):
    """Una llamada al modelo por sección (SPEC-0011 RN-10); cada una va a `generation_logs`."""

    section: int
    provider: str
    model: str
    attempts: int
    latencyMs: int
    tokens: int


class ExamMeta(ResourceMeta):
    calls: list[ExamCallMeta]


class ExamResponse(BaseModel):
    exam: ExamOut
    meta: ExamMeta


class ExamItemResponse(ExamItemOut):
    meta: ResourceMeta


def create_app(
    settings: Settings | None = None,
    provider: AIProvider | None = None,
    client: QdrantClient | None = None,
    llm: LLMChain | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    provider = provider or build_provider(settings)
    llm = llm or build_llm(settings)
    client = client or QdrantClient(location=settings.qdrant_url)

    if settings.qdrant_url == ":memory:" and not client.collection_exists(settings.collection):
        # Qdrant embebido (E2E y desarrollo sin Docker): se indexa al arrancar o estaría vacío.
        items, version = load_catalog(settings.catalog_dir)
        build_index(client, provider, settings.collection, items, version)

    # Carga los modelos al arrancar: la primera búsqueda no paga ~2 s de carga, que en CPU
    # lenta se acerca al timeout de 3 s de la web (benchmark 2026-10-01).
    provider.embed(["calentamiento"], "query")
    provider.embed_sparse(["calentamiento"], "query")

    app = FastAPI(title="Profe AI Engine", version="0.1.0")
    app.state.settings, app.state.provider, app.state.client = settings, provider, client

    def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
        # RN-01: solo el servidor web, con el token de servicio. Comparación en tiempo constante.
        expected = f"Bearer {settings.ai_engine_token}"
        if not authorization or not hmac.compare_digest(authorization, expected):
            raise HTTPException(status_code=401, detail="No autorizado")

    @app.get("/health")
    def health(request: Request) -> dict:
        info = index_info(request.app.state.client, settings.collection)
        return {"status": "ok", "provider": provider.name, "index": info}

    @app.post(
        "/v1/retrieval/curriculum",
        response_model=CurriculumResponse,
        dependencies=[Depends(require_token)],
    )
    def retrieve(body: CurriculumQuery, request: Request) -> CurriculumResponse:
        started = time.perf_counter()
        hits = search_curriculum(
            request.app.state.client,
            provider,
            settings.collection,
            body.query,
            area=body.area,
            grade=body.grade,
            limit=body.limit,
        )
        latency = int((time.perf_counter() - started) * 1000)
        # RN-04: se registra latencia y cantidad, nunca el texto de la consulta.
        log.info("retrieval.curriculum results=%d latency_ms=%d", len(hits), latency)
        info = index_info(request.app.state.client, settings.collection)
        return CurriculumResponse(
            results=[CurriculumHit(code=h.code, score=h.score) for h in hits],
            meta=SearchMeta(
                provider=provider.name,
                denseModel=provider.dense_model,
                catalogVersion=info["catalogVersion"],
                latencyMs=latency,
            ),
        )

    @app.post(
        "/v1/generation/objective-suggestions",
        response_model=SuggestionsResponse,
        dependencies=[Depends(require_token)],
    )
    def objective_suggestions(body: ObjectiveRequest) -> SuggestionsResponse:
        try:
            result = suggest_objectives(llm, body)
        except LLMUnavailableError as error:
            log.warning("generation.unavailable chain=%s detail=%s", llm.name, error)
            raise HTTPException(status_code=503, detail="unavailable") from error
        except GenerationInvalidError as error:
            log.warning(
                "generation.invalid attempts=%d errors=%d", error.attempts, len(error.errors)
            )
            raise HTTPException(status_code=502, detail="invalid_output") from error
        # RN-05: se registran métricas y versión del prompt; nunca el contexto ni el texto generado.
        log.info(
            "generation.objectives provider=%s model=%s attempts=%d latency_ms=%d",
            result.provider,
            result.model,
            result.attempts,
            result.latency_ms,
        )
        return SuggestionsResponse(
            suggestions=[
                SuggestionOut(statement=s.statement, dbaCodes=s.dbaCodes)
                for s in result.suggestions
            ],
            meta=GenerationMeta(
                provider=result.provider,
                model=result.model,
                promptVersion=PROMPT_VERSION,
                attempts=result.attempts,
                latencyMs=result.latency_ms,
            ),
        )

    def run_resource[T](
        task: str, prompt_version: str, run: Callable[[], StructuredResult[T]]
    ) -> tuple[T, ResourceMeta]:
        try:
            result = run()
        except LLMUnavailableError as error:
            log.warning("generation.unavailable task=%s chain=%s detail=%s", task, llm.name, error)
            raise HTTPException(status_code=503, detail="unavailable") from error
        except GenerationInvalidError as error:
            log.warning(
                "generation.invalid task=%s attempts=%d errors=%d",
                task,
                error.attempts,
                len(error.errors),
            )
            raise HTTPException(status_code=502, detail="invalid_output") from error
        # Solo métricas y versión del prompt; nunca el contexto ni el texto generado.
        log.info(
            "generation.%s provider=%s model=%s attempts=%d latency_ms=%d tokens=%d",
            task,
            result.provider,
            result.model,
            result.attempts,
            result.latency_ms,
            result.tokens,
        )
        return result.value, ResourceMeta(
            provider=result.provider,
            model=result.model,
            promptVersion=prompt_version,
            attempts=result.attempts,
            latencyMs=result.latency_ms,
            tokens=result.tokens,
        )

    @app.post(
        "/v1/generation/quiz", response_model=QuizResponse, dependencies=[Depends(require_token)]
    )
    def quiz(body: QuizRequest) -> QuizResponse:
        value, meta = run_resource("quiz", QUIZ_PROMPT_VERSION, lambda: generate_quiz(llm, body))
        return QuizResponse(quiz=value, meta=meta)

    @app.post(
        "/v1/generation/workshop",
        response_model=WorkshopResponse,
        dependencies=[Depends(require_token)],
    )
    def workshop(body: WorkshopRequest) -> WorkshopResponse:
        value, meta = run_resource(
            "workshop", workshop_prompt_version(body), lambda: generate_workshop(llm, body)
        )
        return WorkshopResponse(workshop=value, meta=meta)

    @app.post(
        "/v1/generation/item", response_model=ItemResponse, dependencies=[Depends(require_token)]
    )
    def item(body: ItemRequest) -> ItemResponse:
        value, meta = run_resource("item", ITEM_PROMPT_VERSION, lambda: regenerate_item(llm, body))
        return ItemResponse(item=value.item, meta=meta)

    @app.post(
        "/v1/generation/exam", response_model=ExamResponse, dependencies=[Depends(require_token)]
    )
    def exam(body: ExamRequest) -> ExamResponse:
        calls: list[ExamCallMeta] = []

        def run():
            result = generate_exam(llm, body)
            calls.extend(
                ExamCallMeta(
                    section=i + 1,
                    provider=c.provider,
                    model=c.model,
                    attempts=c.attempts,
                    latencyMs=c.latency_ms,
                    tokens=c.tokens,
                )
                for i, c in enumerate(result.calls)
            )
            return result

        value, meta = run_resource("exam", EXAM_PROMPT_VERSION, run)  # type: ignore[arg-type]
        return ExamResponse(exam=value, meta=ExamMeta(**meta.model_dump(), calls=calls))

    @app.post(
        "/v1/generation/exam/item",
        response_model=ExamItemResponse,
        dependencies=[Depends(require_token)],
    )
    def exam_item(body: ExamItemRequest) -> ExamItemResponse:
        value, meta = run_resource(
            "exam_item", EXAM_ITEM_PROMPT_VERSION, lambda: regenerate_exam_item(llm, body)
        )
        return ExamItemResponse(item=value.item, meta=meta)

    @app.post(
        "/v1/formats/analyze", response_model=FormatResponse, dependencies=[Depends(require_token)]
    )
    def format_analysis(body: FormatRequest) -> FormatResponse:
        value, meta = run_resource(
            "format_analysis", FORMAT_PROMPT_VERSION, lambda: analyze_format(llm, body)
        )
        return FormatResponse(header=value.header, sections=value.sections, meta=meta)

    return app
