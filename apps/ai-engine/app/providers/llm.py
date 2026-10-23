"""Generación con LLM (plan maestro §7.1: generate y stream) — ADR-0007.

`OpenAICompatibleLLM` habla la API de chat compatible con OpenAI, que usan Groq, Ollama, vLLM y
casi todos los proveedores: cambiar de uno a otro es configuración. `LLMChain` intenta los
proveedores en orden y pasa al siguiente si uno falla o llega a su límite.
"""

import json
import re
import time
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol

import httpx

THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)

# Ante un 429, si el proveedor pide esperar poco, se espera y se reintenta el mismo modelo antes de
# pasar al siguiente de la cadena (los planes gratuitos limitan tokens por minuto, ADR-0007).
MAX_RATE_LIMIT_WAIT_S = 20.0
MAX_RATE_LIMIT_RETRIES = 2

# Delimitadores del contexto en el prompt: lo que va entre ellos es dato, nunca instrucción.
DATA_START = "<<<DATOS>>>"
DATA_END = "<<<FIN_DATOS>>>"


@dataclass(frozen=True)
class Message:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass(frozen=True)
class Completion:
    text: str
    provider: str
    model: str
    # Tokens de entrada + salida que reporta el proveedor (0 si no los reporta).
    tokens: int = 0


class LLMUnavailableError(Exception):
    """Ningún proveedor de la cadena pudo responder."""


class LLM(Protocol):
    name: str
    model: str

    def generate(
        self,
        messages: list[Message],
        *,
        json_mode: bool,
        max_tokens: int,
        max_wait_s: float = MAX_RATE_LIMIT_WAIT_S,
    ) -> Completion: ...

    def stream(self, messages: list[Message], *, max_tokens: int) -> Iterator[str]: ...


def _retry_after(response: httpx.Response) -> float | None:
    """Segundos a esperar si es un 429 con Retry-After; None si no aplica (se pasa al siguiente)."""
    raw = response.headers.get("retry-after") if response.status_code == 429 else None
    try:
        return max(0.0, float(raw)) if raw is not None else None
    except ValueError:
        return None


def _failed_generation(response: httpx.Response) -> str | None:
    """Groq responde 400 `json_validate_failed` si el modelo produjo JSON inválido en modo JSON.

    Trae el texto generado: se devuelve para que el pipeline lo repare con los errores concretos,
    en vez de descartar el modelo como si estuviera caído.
    """
    if response.status_code != 400:
        return None
    try:
        error = response.json().get("error") or {}
    except ValueError:
        return None
    if error.get("code") != "json_validate_failed":
        return None
    return error.get("failed_generation") or ""


def _clean(text: str) -> str:
    # Algunos modelos (Qwen3) emiten su razonamiento entre <think>: nunca llega al producto.
    return THINK_BLOCK.sub("", text).strip()


class OpenAICompatibleLLM:
    def __init__(
        self,
        name: str,
        base_url: str,
        model: str,
        api_key: str | None = None,
        timeout: float = 60.0,
        extra_body: dict | None = None,
        transport: httpx.BaseTransport | None = None,
        sleep=time.sleep,
    ):
        self._sleep = sleep
        self.name = name
        self.model = model
        self._extra = extra_body or {}
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"), headers=headers, timeout=timeout, transport=transport
        )

    def _body(self, messages: list[Message], max_tokens: int) -> dict:
        return {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": max_tokens,
            "temperature": 0.4,
            **self._extra,
        }

    def generate(
        self,
        messages: list[Message],
        *,
        json_mode: bool,
        max_tokens: int,
        max_wait_s: float = MAX_RATE_LIMIT_WAIT_S,
    ) -> Completion:
        body = self._body(messages, max_tokens)
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        response = self._client.post("/chat/completions", json=body)
        for _ in range(MAX_RATE_LIMIT_RETRIES):
            wait = _retry_after(response)
            if wait is None or wait > max_wait_s:
                break
            self._sleep(wait)
            response = self._client.post("/chat/completions", json=body)
        failed = _failed_generation(response)
        if failed is not None:
            return Completion(text=_clean(failed), provider=self.name, model=self.model)
        response.raise_for_status()
        payload = response.json()
        text = payload["choices"][0]["message"]["content"] or ""
        tokens = int((payload.get("usage") or {}).get("total_tokens") or 0)
        return Completion(text=_clean(text), provider=self.name, model=self.model, tokens=tokens)

    def stream(self, messages: list[Message], *, max_tokens: int) -> Iterator[str]:
        body = {**self._body(messages, max_tokens), "stream": True}
        with self._client.stream("POST", "/chat/completions", json=body) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line.startswith("data:"):
                    continue
                data = line.removeprefix("data:").strip()
                if data == "[DONE]":
                    return
                delta = json.loads(data)["choices"][0].get("delta", {}).get("content")
                if delta:
                    yield delta


class LLMChain:
    """Intenta cada proveedor en orden; errores de red, 429 o 5xx pasan al siguiente."""

    def __init__(self, llms: list[LLM]):
        if not llms:
            raise ValueError("La cadena necesita al menos un proveedor")
        self.llms = llms
        self.name = "+".join(llm.name for llm in llms)
        self.model = llms[0].model

    def generate(
        self,
        messages: list[Message],
        *,
        json_mode: bool,
        max_tokens: int,
        max_wait_s: float = MAX_RATE_LIMIT_WAIT_S,
    ) -> Completion:
        failures = []
        for llm in self.llms:
            try:
                return llm.generate(
                    messages, json_mode=json_mode, max_tokens=max_tokens, max_wait_s=max_wait_s
                )
            except (httpx.HTTPError, KeyError, ValueError) as error:
                status = getattr(getattr(error, "response", None), "status_code", None)
                failures.append(f"{llm.name}: {status or type(error).__name__}")
        raise LLMUnavailableError("; ".join(failures))

    def stream(self, messages: list[Message], *, max_tokens: int) -> Iterator[str]:
        for llm in self.llms:
            try:
                yield from llm.stream(messages, max_tokens=max_tokens)
                return
            except httpx.HTTPError:
                continue
        raise LLMUnavailableError("ningún proveedor respondió")
