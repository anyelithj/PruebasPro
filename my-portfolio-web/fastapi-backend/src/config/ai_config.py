"""[SRP] configuración de IA — Ollama base_url, modelos y temperatura en un solo lugar.

Sin API keys de terceros: todo corre contra un Ollama local/self-hosted.
"""

from dataclasses import dataclass

from src.config.settings import settings


@dataclass(frozen=True)
class AiConfig:
    base_url: str
    chat_model: str
    embed_model: str
    temperature: float


def get_ai_config() -> AiConfig:
    """[DI] snapshot inmutable de la config de IA derivada de Settings."""
    return AiConfig(
        base_url=settings.ollama_base_url,
        chat_model=settings.ollama_chat_model,
        embed_model=settings.ollama_embed_model,
        temperature=settings.ai_temperature,
    )
