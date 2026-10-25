"""[OBSERVER][SRP] WS /ws/blockchain/ethereum — empuja cada evento del agente."""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.common.exceptions.blockchain_exception import BlockchainException
from src.module.blockchain.ethereum.service.ethereum_service import EthereumService

logger = logging.getLogger(__name__)

ws_router = APIRouter()


@ws_router.websocket("/ws/blockchain/ethereum")
async def ethereum_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    service = EthereumService()
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
        logger.info("Ethereum WS disconnected")
    except Exception as exc:  # noqa: BLE001
        logger.error("Ethereum WS error: %s", exc)
        await websocket.close(code=1011)
