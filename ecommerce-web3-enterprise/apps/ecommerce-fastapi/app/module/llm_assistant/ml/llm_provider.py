# llm_provider.py (Python ABC + Redis) => gateway del LLM (Plan 5B.1): el service solo conoce el
# puerto LlmProvider, no a Ollama. Aquí viven también los decoradores comunes a cualquier proveedor:
# reintentos + fallback entre modelos (FallbackProvider) y caché Redis de respuestas
# (CachedProvider).
# Patrón: Adapter/Strategy (puerto de la arquitectura hexagonal) + DIP + Decorator (FallbackProvider
# y CachedProvider envuelven a otro LlmProvider sin modificarlo) + Chain of Responsibility (cada
# proveedor del fallback intenta hasta que uno responde). Paradigma: POO + asíncrono.

import json
from abc import ABC, abstractmethod  # ABC => clase abstracta; abstractmethod => método obligatorio
from collections.abc import AsyncIterator  # Tipo de un generador asíncrono (async for)
from dataclasses import dataclass
from typing import Any

from redis.exceptions import RedisError

from app.config.redis_config import get_redis
from app.module.llm_assistant.exception.llm_exception import LlmProviderError
from app.shared.decorator.cache_decorator import content_hash

# ChatMessage => {"role": "system" | "user" | "assistant" | "tool", "content": str, ...}. "Any":
# los mensajes de tool use llevan "tool_calls" (lista) además del texto
ChatMessage = dict[str, Any]


# ToolRequest => Value Object: el modelo pide ejecutar una herramienta con estos argumentos
# ("frozen=True" => inmutable: nadie altera la petición entre el LLM y el ejecutor)
@dataclass(frozen=True)
class ToolRequest:
    name: str
    arguments: dict[str, Any]


# StreamPart => lo que emite un proveedor: texto (token) o una petición de herramienta
# ("|" en tipos => unión, PEP 604)
type StreamPart = str | ToolRequest


class LlmProvider(ABC):
    name: str  # Modelo usado (se guarda en cada mensaje para trazabilidad)

    # stream => genera la respuesta fragmento a fragmento (tokens) para enviarla por SSE; con
    # "tools" el modelo puede pedir herramientas (ToolRequest) en vez de responder texto
    # "@abstractmethod" => Python no deja instanciar una subclase que no lo implemente
    @abstractmethod
    def stream(
        self, messages: list[ChatMessage], tools: list[dict[str, Any]] | None = None
    ) -> AsyncIterator[StreamPart]: ...


# FallbackProvider => intenta cada proveedor en orden ("retries" reintentos extra por proveedor)
# mientras NO se haya emitido nada: si el fallo llega a mitad de respuesta no se repite (el usuario
# ya leyó parte y se duplicaría). Se crea uno por petición: "name" refleja el modelo que respondió
# sin carreras entre peticiones concurrentes.
class FallbackProvider(LlmProvider):
    def __init__(self, providers: list[LlmProvider], retries: int) -> None:
        self.providers, self.retries = providers, retries
        self.name = providers[0].name

    async def stream(
        self, messages: list[ChatMessage], tools: list[dict[str, Any]] | None = None
    ) -> AsyncIterator[StreamPart]:
        for provider in self.providers:
            for _ in range(self.retries + 1):  # "_" => variable que no se usa
                emitted = False
                try:
                    async for part in provider.stream(messages, tools):
                        emitted = True
                        yield part
                    self.name = provider.name
                    return
                except LlmProviderError:
                    if emitted:  # Falló a mitad de la respuesta: se informa, no se reintenta
                        raise
        raise LlmProviderError()  # Ningún modelo respondió


# CachedProvider => Cache-Aside en Redis: la misma conversación (prompt idéntico, mismo modelo)
# devuelve la respuesta guardada sin volver a ejecutar el LLM (0 CPU/GPU para preguntas
# frecuentes). La clave es el hash del prompt COMPLETO (contexto RAG, historial y resultados de
# herramientas incluidos): nunca se sirve a un usuario la respuesta construida con datos de otro.
# Si el modelo pide herramientas no se cachea (la respuesta final depende de datos en vivo).
class CachedProvider(LlmProvider):
    def __init__(self, inner: LlmProvider, ttl: int) -> None:
        self.inner, self.ttl = inner, ttl

    # "@property" => "name" se lee como atributo pero sigue al proveedor interno (fallback)
    @property
    def name(self) -> str:  # type: ignore[override]
        return self.inner.name

    def _key(self, messages: list[ChatMessage], tools: list[dict[str, Any]] | None) -> str:
        payload = json.dumps([self.inner.name, messages, bool(tools)], sort_keys=True, default=str)
        return f"ml:llm:answer:{content_hash(payload)}"

    async def stream(
        self, messages: list[ChatMessage], tools: list[dict[str, Any]] | None = None
    ) -> AsyncIterator[StreamPart]:
        key, redis = self._key(messages, tools), get_redis()
        try:
            if cached := await redis.get(key):  # ":=" (walrus) asigna y evalúa
                yield cached  # Un solo evento: la respuesta completa ya existe
                return
        except RedisError:
            pass  # Sin Redis se responde igual, solo sin caché
        parts: list[str] = []
        used_tools = False
        async for part in self.inner.stream(messages, tools):
            used_tools = used_tools or isinstance(part, ToolRequest)
            if isinstance(part, str):
                parts.append(part)
            yield part
        if parts and not used_tools:
            try:
                await redis.set(key, "".join(parts), ex=self.ttl)  # "ex" => TTL en segundos
            except RedisError:
                pass
