"""[ISP] tipos de eventos de streaming WS/SSE — contrato mínimo compartido."""

from enum import StrEnum

from pydantic import BaseModel


class ChatEventType(StrEnum):
    CHUNK = "chunk"       # Fragmento de texto del modelo.
    SOURCE = "source"     # Fuente citada (RAG).
    DONE = "done"         # Fin del stream.
    ERROR = "error"       # Error durante la generación.


class ChatEventDto(BaseModel):
    type: ChatEventType
    content: str = ""
    source: str | None = None

    def to_sse(self) -> str:
        """Serializa el evento al formato text/event-stream."""
        return f"data: {self.model_dump_json()}\n\n"

    @classmethod
    def chunk(cls, content: str) -> "ChatEventDto":
        return cls(type=ChatEventType.CHUNK, content=content)

    @classmethod
    def from_source(cls, source: str) -> "ChatEventDto":
        return cls(type=ChatEventType.SOURCE, source=source)

    @classmethod
    def done(cls) -> "ChatEventDto":
        return cls(type=ChatEventType.DONE)

    @classmethod
    def error(cls, message: str) -> "ChatEventDto":
        return cls(type=ChatEventType.ERROR, content=message)
