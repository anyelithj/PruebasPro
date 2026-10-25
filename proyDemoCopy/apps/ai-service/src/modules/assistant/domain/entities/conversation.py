"""Entity Conversation — turnos de mensajes de una sesion de chat.

[Patron]: Aggregate Root (DDD).
[Principio]: SRP.
[Paradigma]: POO + dataclass.
"""
from dataclasses import dataclass, field
from datetime import UTC, datetime

from src.modules.assistant.domain.value_objects.message import Message


@dataclass
class Conversation:
    """Conversacion completa de un usuario con el agente tutor."""

    id: str
    user_id: str
    messages: list[Message] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def append(self, msg: Message) -> None:
        self.messages.append(msg)

    # [Ventana de contexto]: ultimos N turnos para prompt | [Principio]: KISS
    def last_n(self, n: int = 10) -> list[Message]:
        return self.messages[-n:]
