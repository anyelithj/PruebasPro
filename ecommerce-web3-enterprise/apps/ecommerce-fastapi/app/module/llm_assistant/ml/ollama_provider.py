# ollama_provider.py (Ollama AsyncClient) => proveedor LLM local por defecto (0 USD; los datos no
# salen de la máquina) + Factory que arma el gateway por configuración (Plan 5B.1) y enruta cada
# pregunta al modelo económico o al potente (Plan 5B.5).
# Patrón: Adapter (LlmProvider -> API de Ollama) + Singleton (un cliente HTTP por modelo y proceso)
# + Lazy Initialization (el cliente se crea con el primer mensaje) + Factory (select_provider).
# Paradigma: asíncrono (async for sobre el stream HTTP) + POO.
# Ahorro de recursos: modelo pequeño por entorno (OLLAMA_MODEL), tope de tokens (num_predict),
# keep_alive corto (Ollama descarga el modelo de la RAM al poco tiempo sin uso), el modelo potente
# solo se carga si una pregunta lo necesita y nada se carga al arrancar: si nadie usa el chat, el
# asistente no consume CPU ni memoria.

import re
from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Any

import httpx  # Transporte HTTP de ollama: sus errores de red no heredan de OSError
import ollama

from app.config.llm_config import get_llm_settings
from app.module.llm_assistant.exception.llm_exception import LlmProviderError
from app.module.llm_assistant.ml.llm_provider import (
    CachedProvider,
    ChatMessage,
    FallbackProvider,
    LlmProvider,
    StreamPart,
    ToolRequest,
)


class OllamaProvider(LlmProvider):
    def __init__(self, model: str) -> None:
        settings = get_llm_settings()
        self.name = model
        self.client = ollama.AsyncClient(
            host=settings.OLLAMA_BASE_URL, timeout=settings.OLLAMA_TIMEOUT_SECONDS
        )

    # "async def" + "yield" => generador asíncrono: entrega cada fragmento apenas llega de Ollama
    async def stream(
        self, messages: list[ChatMessage], tools: list[dict[str, Any]] | None = None
    ) -> AsyncIterator[StreamPart]:
        settings = get_llm_settings()
        try:
            chunks = await self.client.chat(
                model=self.name,
                messages=messages,
                tools=tools,  # None => el modelo solo puede responder texto
                stream=True,  # Respuesta token a token (el usuario lee mientras se genera)
                keep_alive=settings.OLLAMA_KEEP_ALIVE,
                # "num_predict" => tope de tokens; temperatura baja => respuestas estables
                options={"num_predict": settings.LLM_MAX_TOKENS, "temperature": 0.3},
            )
            async for chunk in chunks:
                # Tool use: el modelo pide herramientas en lugar de (o antes de) responder
                for call in chunk.message.tool_calls or []:
                    yield ToolRequest(call.function.name, dict(call.function.arguments))
                if text := chunk.message.content:  # ":=" (walrus) asigna y evalúa
                    yield text
        # Servidor apagado, modelo no descargado o tiempo agotado => error de dominio (503)
        except (ollama.ResponseError, httpx.HTTPError, OSError) as error:
            raise LlmProviderError() from error


# _ollama => Singleton por modelo ("maxsize=2": económico y potente)
@lru_cache(maxsize=2)
def _ollama(model: str) -> OllamaProvider:
    return OllamaProvider(model)


# Pistas de pregunta compleja (comparar, explicar, analizar) en español e inglés
COMPLEX_HINTS = re.compile(
    r"\b(compar|diferencia|explica|analiz|ventajas|versus|vs\.?|explain|difference)", re.I
)
LONG_QUESTION_CHARS = 400


# needs_strong_model => enrutamiento económico vs potente (Plan 5B.5)
# ponytail: heurística por longitud y palabras clave; un clasificador entrenado con el feedback
# 👍/👎 la reemplazaría si el modelo económico falla demasiado en preguntas cortas
def needs_strong_model(question: str) -> bool:
    return len(question) > LONG_QUESTION_CHARS or bool(COMPLEX_HINTS.search(question))


# select_provider => Factory: gateway para una pregunta = [potente?] + económico, con reintentos,
# fallback y caché. Objeto nuevo por petición (barato: los clientes HTTP son Singleton)
# ("cache=False" => evaluaciones: miden la latencia real del modelo)
def select_provider(question: str, tier: str | None = None, cache: bool = True) -> LlmProvider:
    settings = get_llm_settings()
    models = [settings.OLLAMA_MODEL]
    strong = settings.OLLAMA_STRONG_MODEL
    if strong and (tier == "strong" or (tier is None and needs_strong_model(question))):
        models.insert(0, strong)  # Si el potente falla, responde el económico (fallback)
    provider: LlmProvider = FallbackProvider(
        [_ollama(model) for model in models], settings.LLM_RETRIES
    )
    if cache and settings.LLM_CACHE_TTL_SECONDS > 0:
        provider = CachedProvider(provider, settings.LLM_CACHE_TTL_SECONDS)
    return provider
