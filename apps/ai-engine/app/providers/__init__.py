from ..config import Settings
from .base import AIProvider, SparseVector
from .llm import LLMChain, LLMUnavailableError, Message, OpenAICompatibleLLM
from .local import LocalProvider
from .mock import MockAIProvider
from .mock_llm import MockLLM

__all__ = [
    "AIProvider",
    "LLMChain",
    "LLMUnavailableError",
    "LocalProvider",
    "Message",
    "MockAIProvider",
    "MockLLM",
    "OpenAICompatibleLLM",
    "SparseVector",
    "build_llm",
    "build_provider",
]


def build_provider(settings: Settings) -> AIProvider:
    if settings.provider == "mock":
        return MockAIProvider()
    return LocalProvider(
        dense_model=settings.dense_model,
        sparse_model=settings.sparse_model,
        rerank_model=settings.rerank_model,
        cache_dir=settings.models_cache_dir,
    )


def build_llm(settings: Settings, transport=None, sleep=None) -> LLMChain:
    """Arma la cadena de LLM de ADR-0007. `transport` permite simular el servidor en tests."""
    if settings.provider == "mock":
        return LLMChain([MockLLM()])
    timeout = settings.llm_timeout_s
    available = {
        "groq-qwen": settings.groq_api_key
        and OpenAICompatibleLLM(
            "groq",
            settings.groq_base_url,
            settings.groq_qwen_model,
            settings.groq_api_key,
            timeout,
            {"reasoning_effort": "none"},
            transport,
            **({"sleep": sleep} if sleep else {}),
        ),
        "groq-gptoss": settings.groq_api_key
        and OpenAICompatibleLLM(
            "groq",
            settings.groq_base_url,
            settings.groq_gptoss_model,
            settings.groq_api_key,
            timeout,
            {"reasoning_effort": "low"},
            transport,
            **({"sleep": sleep} if sleep else {}),
        ),
        "ollama": OpenAICompatibleLLM(
            "ollama",
            settings.ollama_base_url,
            settings.ollama_model,
            None,
            # En CPU el modelo local es lento: más margen de tiempo.
            max(timeout, 180.0),
            {"reasoning_effort": "none"},
            transport,
            **({"sleep": sleep} if sleep else {}),
        ),
        "vllm": settings.vllm_base_url
        and settings.vllm_model
        and OpenAICompatibleLLM(
            "vllm",
            settings.vllm_base_url,
            settings.vllm_model,
            settings.vllm_api_key,
            timeout,
            None,
            transport,
            **({"sleep": sleep} if sleep else {}),
        ),
    }
    chain = [available[name] for name in settings.llm_chain if available.get(name)]
    return LLMChain(chain)
