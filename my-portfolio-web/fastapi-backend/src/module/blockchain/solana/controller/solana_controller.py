"""[MVC-C][SRP] entrada del agente Solana — POST /chat (unario) + GET /stream (SSE).

Solo delega en SolanaService. El SSE espeja el patrón astream_events → text/event-stream.
"""

import json

from fastapi.responses import StreamingResponse

from src.common.schemas.api_response import ApiResponse
from src.module.blockchain.solana.dto.solana_response_dto import SolanaResponseDto
from src.module.blockchain.solana.service.solana_service import SolanaService

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


class SolanaController:
    @staticmethod
    async def chat(
        service: SolanaService, message: str, wallet: str | None
    ) -> ApiResponse[SolanaResponseDto]:
        return ApiResponse.ok(await service.invoke(message, wallet))

    @staticmethod
    def stream(
        service: SolanaService, message: str, wallet: str | None
    ) -> StreamingResponse:
        async def event_generator():
            async for event in service.stream(message, wallet):
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(), media_type="text/event-stream", headers=_SSE_HEADERS
        )
