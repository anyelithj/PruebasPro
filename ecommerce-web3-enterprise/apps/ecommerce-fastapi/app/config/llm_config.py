# llm_config.py (pydantic-settings) => configuración del LLM local (Ollama), del codificador de
# texto y del LLM Assistant (gateway, RAG, tool use, límites).
# Patrón: Singleton + Options/Settings. Paradigma: declarativo.
# Ahorro de recursos: el modelo se elige por variable de entorno; un modelo pequeño (qwen2.5:3b,
# 1,9 GB) consume bastante menos RAM y energía que Llama3 8B (4,7 GB) con calidad suficiente para
# respuestas cortas de soporte.

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class LlmSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    # Modelo de chat: pequeño por defecto (qwen2.5:3b); Llama3 u otro se elige con OLLAMA_MODEL
    OLLAMA_MODEL: str = "qwen2.5:3b"
    # Embeddings multilingües (XLM-RoBERTa, familia BERT) de 768 dimensiones, ~560 MB: en pruebas
    # con frases en español acertó 9/10 en sentimiento frente a 6/10 de nomic-embed-text (solo
    # inglés)
    OLLAMA_EMBED_MODEL: str = "granite-embedding:278m"
    OLLAMA_TIMEOUT_SECONDS: float = 60.0
    LLM_MAX_TOKENS: int = 256  # Tope de tokens generados: respuestas cortas = menos cómputo
    # keep_alive => tiempo que Ollama deja el modelo en RAM tras la última respuesta; corto = la
    # memoria se libera poco después de que nadie use el chat (el siguiente mensaje lo recarga)
    OLLAMA_KEEP_ALIVE: str = "2m"
    # Codificador de texto para sentimiento/intenciones: "ollama" (granite, liviano) o "bert"
    # (BERT multilingüe de KerasHub; requiere TensorFlow)
    TEXT_ENCODER: Literal["ollama", "bert"] = "ollama"

    # --- Fase 5B · LLM Assistant ---
    # Modelo "potente" para preguntas largas o de comparación (5B.5: enrutamiento económico vs
    # potente). Vacío => todo va al modelo económico (OLLAMA_MODEL) y no se carga un segundo modelo
    OLLAMA_STRONG_MODEL: str = ""
    LLM_RETRIES: int = 1  # Reintentos por modelo antes de pasar al siguiente (fallback)
    LLM_CACHE_TTL_SECONDS: int = 3600  # Caché Redis de respuestas idénticas (0 => sin caché)
    LLM_RATE_LIMIT_PER_MINUTE: int = 10  # Mensajes por usuario y minuto (429 al superarlo)
    LLM_TOOLS_ENABLED: bool = True  # Tool use (el modelo debe soportarlo: qwen2.5, llama3.1...)
    RAG_TOP_K: int = 3  # Fragmentos de conocimiento por pregunta (contexto corto = menos tokens)
    RAG_MIN_SIMILARITY: float = 0.35  # Coseno mínimo: por debajo el fragmento no es relevante
    # Backend Express al que llaman las herramientas (tool use) con el JWT del usuario
    EXPRESS_API_URL: str = "http://localhost:4000"
    TOOL_TIMEOUT_SECONDS: float = 5.0


@lru_cache(maxsize=1)
def get_llm_settings() -> LlmSettings:
    return LlmSettings()
