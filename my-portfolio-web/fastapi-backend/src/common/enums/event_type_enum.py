"""[CC-N] tipos de evento (WebSocket / dominio)."""

from enum import StrEnum


class EventType(StrEnum):
    MESSAGE_CHUNK = "message.chunk"
    MESSAGE_DONE = "message.done"
    ERROR = "error"
