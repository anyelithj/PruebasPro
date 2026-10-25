"""[OBSERVER][SRP] WebSocket de chat IA — el servidor empuja cada chunk al cliente.

Protocolo:
  cliente → {"content": "...", "session_id": "...", "provider": "ollama"}
  servidor → {"type": "chunk"|"source"|"done"|"error", "content": ..., "source": ...}
"""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import async_session_factory
from src.module.chat.dto.chat_event_dto import ChatEventDto
from src.module.chat.dto.send_message_dto import SendMessageDto
from src.module.chat.repository.chat_repository import ChatRepository
from src.module.chat.service.ai_provider_service import AiProviderService
from src.module.chat.service.chat_service import ChatService

logger = logging.getLogger(__name__)

ws_router = APIRouter()


@ws_router.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_json()
            try:
                dto = SendMessageDto.model_validate(raw)
            except ValidationError as exc:
                await websocket.send_text(ChatEventDto.error(str(exc)).model_dump_json())
                continue

            session: AsyncSession = async_session_factory()
            try:
                service = ChatService(ChatRepository(session), AiProviderService())
                async for event in service.stream(dto):
                    await websocket.send_text(event.model_dump_json())
            finally:
                await session.close()
    except WebSocketDisconnect:
        logger.info("Chat WS disconnected")
    except Exception as exc:  # noqa: BLE001
        logger.error("Chat WS error: %s", exc)
        await websocket.close(code=1011)
