"""[FACADE] registra los routers del contexto blockchain — Solana + Ethereum.

Agrupa REST/SSE (routers) y WebSocket (ws_routers) para que main.py los monte
con una sola llamada, sin conocer la estructura interna del módulo.
"""

from fastapi import APIRouter

from src.module.blockchain.ethereum.controller.ethereum_ws_controller import (
    ws_router as ethereum_ws_router,
)
from src.module.blockchain.ethereum.route.ethereum_router import (
    router as ethereum_router,
)
from src.module.blockchain.solana.controller.solana_ws_controller import (
    ws_router as solana_ws_router,
)
from src.module.blockchain.solana.route.solana_router import router as solana_router


def get_blockchain_router() -> APIRouter:
    """Router REST/SSE agrupado de ambas cadenas (bajo el prefijo de la API)."""
    api = APIRouter()
    api.include_router(solana_router)
    api.include_router(ethereum_router)
    return api


def get_blockchain_ws_routers() -> list[APIRouter]:
    """Routers WebSocket — se montan en la raíz de la app (fuera del prefijo API)."""
    return [solana_ws_router, ethereum_ws_router]
