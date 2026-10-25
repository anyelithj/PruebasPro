"""Settings centralizados via Pydantic v2 BaseSettings.

[Patrón]: Configuration Object + Singleton (lru_cache).
[Principio]: SSOT — todas las env vars pasan por aquí.
[Paradigma]: POO + Funcional (factory cacheado).
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración global tipada e inmutable."""

    # [Config]: lee .env, ignora vars no declaradas | [Principio]: ISP
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ===== Server =====
    env: Literal["development", "staging", "production"] = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    api_prefix: str = "/api/v1"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # ===== Database =====
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/languageproject"
    )

    # ===== Redis =====
    redis_url: str = "redis://localhost:6379/0"

    # ===== Voz local (Sprint 4.7) =====
    # Ruta de espeak-ng; vacío → PATH del sistema o C:/Program Files/eSpeak NG (instalación de winget)
    espeak_ng_path: str | None = None

    # ===== Voz a texto (Sprint 8.6) =====
    # faster-whisper en CPU cuantizado: tiny (~75 MB) · base (~145 MB) · small (~480 MB); se descarga la primera vez
    whisper_model: str = "base"
    whisper_compute_type: str = "int8"
    speech_max_upload_mb: int = 25  # [2026-10-23]: canciones MP3 / videos cortos (antes 10: solo grabaciones de juego)
    speech_pause_threshold_s: float = 0.6  # Silencio entre palabras que cuenta como pausa (configurable, RF-105)
    alignment_max_upload_mb: int = 20  # [Sprint 9.4]: canción o diálogo completo (≈ 4–5 min en MP3); el audio no se guarda
    level_classifier_min_confidence: float = 0.6  # [Sprint 9.5]: por debajo, la rúbrica CEFR del LLM decide el caso dudoso

    # ===== Backend NestJS =====
    backend_url: str = "http://localhost:4000"
    backend_api_prefix: str = "/api/v1"

    # ===== JWT (debe coincidir con NestJS access secret) =====
    jwt_access_secret: str = "change-me-access-secret-min-32-chars-long"
    jwt_algorithm: Literal["HS256", "RS256"] = "HS256"

    # ===== Ollama =====
    ollama_url: str = "http://localhost:11434"
    # [Modelo por defecto]: el MISMO que usa NestJS (aya-expanse:8b) → un solo modelo residente en RAM | [Principio]: SSOT
    ollama_model: str = "aya-expanse:8b"
    # [keep_alive]: carga bajo demanda; Ollama libera el modelo tras este tiempo de inactividad
    ollama_keep_alive: str = "5m"

    # ===== LLM propio · corrector de redacciones (Sprint 5.6, RF-144) =====
    # Nombre del GGUF registrado en Ollama (training/writing_corrector/Modelfile); si no existe se usa ollama_model
    ollama_corrector_model: str = "aula-corrector"
    own_llm_timeout_s: float = 120.0  # Un 8B en CPU puede tardar en cargar la primera vez
    own_llm_model_card_path: str = "./data/own_llm/model_card.json"  # Lo escribe tests/evaluation/run_eval.py

    # ===== CORS =====
    cors_origins: str = "http://localhost:7000,http://localhost:4000"

    # ===== Modelos IA =====
    # Multilingüe (50+ idiomas, incluye zh y ru): la plataforma enseña 7 idiomas | lo comparten la calificación y el RAG
    sentence_transformer_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    spacy_model: str = "es_core_news_md"
    faiss_index_path: str = "./data/faiss_index"
    # [Agente Guía · Sprint 7.9]: similitud coseno mínima para responder con la FAQ SIN LLM, y para usar una sección del manual
    guide_faq_threshold: float = 0.72
    guide_manual_threshold: float = 0.35

    @property
    def cors_origins_list(self) -> list[str]:
        """Parsea string CSV → lista. [Principio]: SRP."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        """Atajo legible para flags condicionales. [Principio]: DRY."""
        return self.env == "production"


# [Factoría cacheada]: una sola instancia por proceso | [Patrón]: Singleton
@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Retorna la instancia única de Settings (lazy)."""
    return Settings()
