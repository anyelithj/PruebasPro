"""[DIP][ISP] ABC de proveedor IA — stream() → AsyncGenerator[ChatEventDto].

Toda estrategia (Ollama directo, RAG con LlamaIndex) es intercambiable sin
tocar ChatService (LSP). El servicio depende de esta abstracción, no de Ollama.
"""

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator

from src.module.chat.dto.chat_event_dto import ChatEventDto

# Historial como lista de (role, content) — role ∈ {"user", "assistant"}.
ChatHistory = list[tuple[str, str]]


class AiProviderInterface(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Identificador del provider — 'ollama' | 'rag'."""

    @abstractmethod
    def stream(
        self, message: str, history: ChatHistory
    ) -> AsyncGenerator[ChatEventDto, None]:
        """Genera la respuesta como stream de eventos tipados."""
        raise NotImplementedError
