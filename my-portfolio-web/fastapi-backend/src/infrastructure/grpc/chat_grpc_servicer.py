"""[ADAPTER] expone el chat IA (streaming) vía gRPC a NestJS."""

import logging
from typing import Any

from src.config.database import async_session_factory
from src.module.chat.dto.send_message_dto import SendMessageDto
from src.module.chat.repository.chat_repository import ChatRepository
from src.module.chat.service.ai_provider_service import AiProviderService
from src.module.chat.service.chat_service import ChatService

logger = logging.getLogger(__name__)


def register(server: Any) -> bool:
    try:
        from src.infrastructure.grpc.generated import chat_pb2, chat_pb2_grpc
    except ImportError:
        logger.warning("Stubs chat_pb2 no generados — servicer no registrado")
        return False

    class ChatServicer(chat_pb2_grpc.ChatServiceServicer):
        async def Stream(self, request, context):  # noqa: N802
            dto = SendMessageDto(
                content=request.message,
                session_id=request.session_id or "grpc",
                provider=request.provider or "ollama",
            )
            session = async_session_factory()
            try:
                service = ChatService(ChatRepository(session), AiProviderService())
                async for event in service.stream(dto, request.user_id or None):
                    yield chat_pb2.ChatEvent(
                        type=event.type.value,
                        content=event.content,
                        source=event.source or "",
                    )
            finally:
                await session.close()

    chat_pb2_grpc.add_ChatServiceServicer_to_server(ChatServicer(), server)
    return True
