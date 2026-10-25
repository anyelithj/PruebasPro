"""[SRP] APIRouter(prefix="/blockchain/ethereum") — chat unario + stream SSE."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from src.common.schemas.api_response import ApiResponse
from src.module.blockchain.ethereum.controller.ethereum_controller import (
    EthereumController,
)
from src.module.blockchain.ethereum.dto.ethereum_chat_dto import EthereumChatDto
from src.module.blockchain.ethereum.dto.ethereum_response_dto import EthereumResponseDto
from src.module.blockchain.ethereum.service.ethereum_service import EthereumService

router = APIRouter(prefix="/blockchain/ethereum", tags=["blockchain-ethereum"])

ServiceDep = Annotated[EthereumService, Depends(EthereumService)]


@router.post("/chat", response_model=ApiResponse[EthereumResponseDto])
async def ethereum_chat(
    service: ServiceDep, dto: EthereumChatDto
) -> ApiResponse[EthereumResponseDto]:
    return await EthereumController.chat(service, dto.message, dto.wallet_address)


@router.get("/stream")
async def ethereum_stream(
    service: ServiceDep,
    message: Annotated[str, Query(min_length=1, max_length=2000)],
    wallet: Annotated[str | None, Query(max_length=64)] = None,
) -> StreamingResponse:
    return EthereumController.stream(service, message, wallet)
