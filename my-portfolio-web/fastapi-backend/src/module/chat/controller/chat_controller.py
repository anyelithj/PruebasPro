"""[MVC-C][SRP] entrada HTTP del chat — historial REST + stream SSE. Solo delega."""

from src.common.dependencies.db_dependency import DbSession
from src.common.schemas.api_response import ApiResponse
from src.module.chat.dto.send_message_dto import MessageResponseDto
from src.module.chat.repository.chat_repository import ChatRepository
from src.module.chat.service.ai_provider_service import AiProviderService
from src.module.chat.service.chat_service import ChatService


def build_chat_service(session: DbSession) -> ChatService:
    """[DI] arma el ChatService con sus dependencias resueltas por request."""
    return ChatService(ChatRepository(session), AiProviderService())


class ChatController:
    @staticmethod
    async def history(
        service: ChatService, session_id: str
    ) -> ApiResponse[list[MessageResponseDto]]:
        messages = await service.history(session_id)
        return ApiResponse.ok(
            [MessageResponseDto.model_validate(m) for m in messages]
        )
