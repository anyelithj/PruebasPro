"""[OBSERVER][SRP] WS /ws/blockchain/solana — empuja cada evento del agente al cliente.

Protocolo:
  cliente → {"message": "...", "wallet_address": "..."}
  servidor → {"type": "chunk"|"tool_call"|"tool_result"|"done"|"error", ...}
"""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.common.exceptions.blockchain_exception import BlockchainException
from src.module.blockchain.solana.service.solana_service import SolanaService

logger = logging.getLogger(__name__)

ws_router = APIRouter()


@ws_router.websocket("/ws/blockchain/solana")
async def solana_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    service = SolanaService()
    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            wallet = data.get("wallet_address")
            if not message:
                await websocket.send_json({"type": "error", "content": "message vacío"})
                continue
            try:
                async for event in service.stream(message, wallet):
                    await websocket.send_json(event)
            except BlockchainException as exc:
                await websocket.send_json({"type": "error", "content": exc.message})
    except WebSocketDisconnect:
        logger.info("Solana WS disconnected")
    except Exception as exc:  # noqa: BLE001
        logger.error("Solana WS error: %s", exc)
        await websocket.close(code=1011)
