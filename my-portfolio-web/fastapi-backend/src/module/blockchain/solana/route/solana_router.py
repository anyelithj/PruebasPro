"""[SRP] APIRouter(prefix="/blockchain/solana") — chat unario + stream SSE."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from src.common.schemas.api_response import ApiResponse
from src.module.blockchain.solana.controller.solana_controller import SolanaController
from src.module.blockchain.solana.dto.solana_chat_dto import SolanaChatDto
from src.module.blockchain.solana.dto.solana_response_dto import SolanaResponseDto
from src.module.blockchain.solana.service.solana_service import SolanaService

router = APIRouter(prefix="/blockchain/solana", tags=["blockchain-solana"])

ServiceDep = Annotated[SolanaService, Depends(SolanaService)]


@router.post("/chat", response_model=ApiResponse[SolanaResponseDto])
async def solana_chat(
    service: ServiceDep, dto: SolanaChatDto
) -> ApiResponse[SolanaResponseDto]:
    return await SolanaController.chat(service, dto.message, dto.wallet_address)


@router.get("/stream")
async def solana_stream(
    service: ServiceDep,
    message: Annotated[str, Query(min_length=1, max_length=2000)],
    wallet: Annotated[str | None, Query(max_length=64)] = None,
) -> StreamingResponse:
    return SolanaController.stream(service, message, wallet)
