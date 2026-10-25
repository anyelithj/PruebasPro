"""[SRP] APIRouter(prefix="/chat") — historial REST + streaming SSE de la IA."""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from src.common.schemas.api_response import ApiResponse
from src.module.chat.controller.chat_controller import (
    ChatController,
    build_chat_service,
)
from src.module.chat.dto.chat_event_dto import ChatEventDto
from src.module.chat.dto.send_message_dto import MessageResponseDto, SendMessageDto
from src.module.chat.service.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])

ServiceDep = Annotated[ChatService, Depends(build_chat_service)]

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.get("/history/{session_id}", response_model=ApiResponse[list[MessageResponseDto]])
async def get_history(
    service: ServiceDep, session_id: str
) -> ApiResponse[list[MessageResponseDto]]:
    return await ChatController.history(service, session_id)


@router.post("/stream")
async def stream_chat(service: ServiceDep, dto: SendMessageDto) -> StreamingResponse:
    """[OBSERVER] Server-Sent Events — un `data:` por token del modelo."""

    async def event_generator() -> AsyncIterator[str]:
        async for event in service.stream(dto):
            yield event.to_sse()
        yield ChatEventDto.done().to_sse()

    return StreamingResponse(
        event_generator(), media_type="text/event-stream", headers=_SSE_HEADERS
    )
