"""GetConversationUseCase — lee la conversacion almacenada por id.

[Patron]: Query + Use Case.
[Principio]: SRP.
"""
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.infrastructure.repositories.conversation_repository import (
    InMemoryConversationRepository,
)
from src.shared.exceptions.custom_errors import NotFoundDomainError


class GetConversationUseCase:
    def __init__(self, repo: InMemoryConversationRepository) -> None:
        self._repo = repo

    async def execute(self, conversation_id: str) -> Conversation:
        conv = await self._repo.find(conversation_id)
        if not conv:
            raise NotFoundDomainError(f"Conversation {conversation_id} not found")
        return conv
