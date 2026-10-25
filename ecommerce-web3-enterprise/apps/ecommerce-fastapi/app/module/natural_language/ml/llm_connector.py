# llm_connector.py (Ollama) => interfaz hacia el LLM local: chat (generación) y embeddings.
# Patrón: Adapter (expone 2 operaciones simples sobre el cliente de Ollama) + Singleton (un cliente
# HTTP reutilizado por proceso). Paradigma: funcional (funciones sin estado propio).
# LLM local (0 USD, los datos no salen de la máquina). Ahorro: tope de tokens y temperatura baja.

from functools import lru_cache
from typing import Any

import numpy as np
import ollama  # Cliente oficial de Ollama (HTTP hacia el servidor local)

from app.config.llm_config import get_llm_settings


@lru_cache(maxsize=1)
def _client() -> ollama.Client:
    settings = get_llm_settings()
    return ollama.Client(host=settings.OLLAMA_BASE_URL, timeout=settings.OLLAMA_TIMEOUT_SECONDS)


# chat => respuesta del LLM a una lista de mensajes {"role": "system|user|assistant", "content":
# str}
def chat(messages: list[dict[str, str]]) -> str:
    settings = get_llm_settings()
    response = _client().chat(
        model=settings.OLLAMA_MODEL,
        messages=messages,
        # "num_predict" => tope de tokens; "temperature" baja => respuestas factuales y estables
        options={"num_predict": settings.LLM_MAX_TOKENS, "temperature": 0.3},
    )
    return response["message"]["content"].strip()


# embed => matriz (n, 768) de embeddings con norma 1 (coseno = producto punto). Un solo viaje HTTP
# para todo el lote (menos latencia y energía que una llamada por texto)
def embed(texts: list[str]) -> np.ndarray:
    response: Any = _client().embed(model=get_llm_settings().OLLAMA_EMBED_MODEL, input=texts)
    vectors = np.asarray(response["embeddings"], dtype=np.float32)
    # "keepdims=True" => divide cada fila por su propia norma (broadcasting)
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
