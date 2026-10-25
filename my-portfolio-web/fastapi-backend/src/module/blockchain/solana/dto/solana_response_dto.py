"""[ISP] respuesta estructurada del agente Solana — contrato mínimo hacia el cliente.

Coincide con el JSON estándar que FastAPI devuelve a NestJS por gRPC.
"""

from typing import Any

from pydantic import BaseModel


class SolanaResponseDto(BaseModel):
    status: str = "success"
    chain: str = "solana"
    tool_used: str = ""
    agent_response: str = ""
    tool_result: Any = None
    tx_signature: str | None = None
    network: str = "devnet"
    explorer_url: str | None = None
    timestamp: str | None = None
