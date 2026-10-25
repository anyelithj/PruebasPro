"""[ADAPTER] expone el agente blockchain a NestJS vía gRPC.

Convierte la interfaz de SolanaService/EthereumService al contrato blockchain.proto.
El servicer concreto se construye en runtime (register) sobre los stubs generados,
para no depender de la codegen en tiempo de import.
"""

import json
import logging
from datetime import UTC, datetime
from typing import Any

from src.common.enums.blockchain_enum import ChainType
from src.module.blockchain.ethereum.service.ethereum_service import EthereumService
from src.module.blockchain.solana.service.solana_service import SolanaService

logger = logging.getLogger(__name__)


def _service_for(chain: str) -> Any:
    return SolanaService() if chain == ChainType.SOLANA.value else EthereumService()


def register(server: Any) -> bool:
    """Registra BlockchainService en el servidor gRPC. False si faltan los stubs."""
    try:
        from src.infrastructure.grpc.generated import (
            blockchain_pb2,
            blockchain_pb2_grpc,
        )
    except ImportError:
        logger.warning("Stubs blockchain_pb2 no generados — servicer no registrado")
        return False

    class BlockchainServicer(blockchain_pb2_grpc.BlockchainServiceServicer):
        async def Invoke(self, request, context):  # noqa: N802 (contrato gRPC)
            service = _service_for(request.chain)
            result = await service.invoke(request.message, request.wallet or None)
            data = result.model_dump()
            return blockchain_pb2.BlockchainResponse(
                status=data.get("status", "success"),
                chain=data.get("chain", request.chain),
                tool_used=data.get("tool_used", ""),
                agent_response=data.get("agent_response", ""),
                tool_result=json.dumps(data.get("tool_result")),
                tx_signature=data.get("tx_signature") or "",
                tx_hash=data.get("tx_hash") or "",
                network=data.get("network", ""),
                explorer_url=data.get("explorer_url") or "",
                timestamp=data.get("timestamp") or datetime.now(UTC).isoformat(),
            )

        async def Stream(self, request, context):  # noqa: N802
            service = _service_for(request.chain)
            async for event in service.stream(request.message, request.wallet or None):
                yield blockchain_pb2.BlockchainEvent(
                    type=event.get("type", ""),
                    content=event.get("content", ""),
                    tool=event.get("tool", ""),
                    result=json.dumps(event.get("result"))
                    if event.get("result") is not None
                    else "",
                )

    blockchain_pb2_grpc.add_BlockchainServiceServicer_to_server(
        BlockchainServicer(), server
    )
    return True
