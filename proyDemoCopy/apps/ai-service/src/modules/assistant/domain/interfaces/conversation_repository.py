"""Puerto del almacén de conversaciones del asistente (personas con estado: guía, soporte, juego y apertura del avatar).

[Patrón]: Port (Hexagonal) + Repository.
[Principio]: DIP — los casos de uso no saben si la conversación vive en Redis o en memoria (tests / desarrollo sin Redis).
[Paradigma]: POO estructural (`Protocol`: tipado por forma, sin herencia).
[2026-11-13 · Tarea 1 · RNF-06]: dos adaptadores → Redis (producción, varios workers) e InMemory (respaldo y pruebas).
"""

from typing import Protocol

from src.modules.assistant.domain.entities.conversation import Conversation


class ConversationRepository(Protocol):
    """Contrato mínimo: leer, guardar y borrar una conversación por id."""

    async def find(self, conversation_id: str) -> Conversation | None: ...  # `...` (Ellipsis): cuerpo vacío del contrato

    async def save(self, conversation: Conversation) -> Conversation: ...

    async def delete(self, conversation_id: str) -> bool: ...
