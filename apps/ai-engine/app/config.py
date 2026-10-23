"""Configuración del AI Engine por variables de entorno (SPEC-0005, ADR-0006)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ENGINE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENGINE_DIR / ".env", extra="ignore")

    # Token de servicio compartido con la web (RN-01). Nunca se registra en logs.
    ai_engine_token: str = Field(min_length=24)
    provider: Literal["local", "mock"] = "local"

    # ":memory:" usa Qdrant embebido (tests y benchmark).
    qdrant_url: str = "http://localhost:6333"
    collection: str = "curriculum"

    # Modelos: van en configuración, no en el código del dominio (ADR-0006).
    dense_model: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    sparse_model: str = "Qdrant/bm25"
    rerank_model: str | None = None  # desactivado: sin reranker multilingüe con licencia comercial
    models_cache_dir: Path | None = None

    # Generación con LLM (ADR-0007). Cadena en orden; un eslabón sin configuración se omite.
    llm_chain: list[str] = ["groq-qwen", "groq-gptoss", "ollama"]
    llm_timeout_s: float = 60.0
    groq_api_key: str | None = None
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_qwen_model: str = "qwen/qwen3.8-27b"
    groq_gptoss_model: str = "openai/gpt-oss-120b"
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "qwen3:1.7b"
    # Etapa 2: servidor propio con vLLM (u otra API compatible).
    vllm_base_url: str | None = None
    vllm_model: str | None = None
    vllm_api_key: str | None = None

    # Fuente de verdad del catálogo (ADR-0005).
    catalog_dir: Path = ENGINE_DIR.parent / "web" / "curriculum" / "men"


@lru_cache
def get_settings() -> Settings:
    return Settings()
