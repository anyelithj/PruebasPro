"""Tests de GetConversationUseCase — query sobre el repo in-memory."""
import pytest

from src.modules.assistant.application.use_cases.get_conversation import (
    GetConversationUseCase,
)
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.infrastructure.repositories.conversation_repository import (
    InMemoryConversationRepository,
)
from src.shared.exceptions.custom_errors import NotFoundDomainError


class TestGetConversation:
    @pytest.mark.asyncio
    async def test_devuelve_conversacion_existente(self) -> None:
        repo = InMemoryConversationRepository()
        conv = Conversation(id="s1", user_id="u1")
        await repo.save(conv)

        result = await GetConversationUseCase(repo=repo).execute("s1")
        assert result is conv
        assert result.id == "s1"

    @pytest.mark.asyncio
    async def test_conversacion_inexistente_lanza_not_found(self) -> None:
        repo = InMemoryConversationRepository()
        with pytest.raises(NotFoundDomainError, match="not found"):
            await GetConversationUseCase(repo=repo).execute("no-existe")
