"""Repo in-memory de conversaciones (Sprint 3.3 stub).

[Patron]: Repository + Adapter.
[Principio]: SRP + DIP — Use Cases dependen del Port (no implementado aqui aun).
[Paradigma]: POO.

[Sprint 4]: migrar a Redis con TTL para conversaciones efimeras.
"""

from src.modules.assistant.domain.entities.conversation import Conversation


class InMemoryConversationRepository:
    """Repo in-memory thread-safe-enough para single-worker."""

    def __init__(self) -> None:
        self._store: dict[str, Conversation] = {}

    async def find(self, conversation_id: str) -> Conversation | None:
        return self._store.get(conversation_id)

    async def save(self, conversation: Conversation) -> Conversation:
        self._store[conversation.id] = conversation
        return conversation

    # [Sprint 7.9]: el usuario borra su conversación con el Agente Guía (DELETE /assistant/conversation/{id})
    async def delete(self, conversation_id: str) -> bool:
        return self._store.pop(conversation_id, None) is not None
