"""[MVC-C][SRP] entrada del agente Ethereum — POST /chat + GET /stream (SSE). Delega."""

import json

from fastapi.responses import StreamingResponse

from src.common.schemas.api_response import ApiResponse
from src.module.blockchain.ethereum.dto.ethereum_response_dto import EthereumResponseDto
from src.module.blockchain.ethereum.service.ethereum_service import EthereumService

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


class EthereumController:
    @staticmethod
    async def chat(
        service: EthereumService, message: str, wallet: str | None
    ) -> ApiResponse[EthereumResponseDto]:
        return ApiResponse.ok(await service.invoke(message, wallet))

    @staticmethod
    def stream(
        service: EthereumService, message: str, wallet: str | None
    ) -> StreamingResponse:
        async def event_generator():
            async for event in service.stream(message, wallet):
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_generator(), media_type="text/event-stream", headers=_SSE_HEADERS
        )
