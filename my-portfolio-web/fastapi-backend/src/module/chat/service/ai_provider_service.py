"""[STRATEGY] selecciona el provider IA en runtime según el nombre solicitado.

Registro extensible (OCP): agregar un provider nuevo = registrar una entrada,
sin tocar ChatService.
"""

from src.module.chat.strategy.ai_provider_interface import AiProviderInterface
from src.module.chat.strategy.llamaindex_rag_strategy import LlamaIndexRagStrategy
from src.module.chat.strategy.ollama_langchain_strategy import OllamaLangChainStrategy


class AiProviderService:
    def __init__(self) -> None:
        providers: list[AiProviderInterface] = [
            OllamaLangChainStrategy(),
            LlamaIndexRagStrategy(),
        ]
        self._registry: dict[str, AiProviderInterface] = {p.name: p for p in providers}

    def get(self, name: str) -> AiProviderInterface:
        """Devuelve el provider por nombre; cae a 'ollama' si no existe."""
        return self._registry.get(name, self._registry["ollama"])
