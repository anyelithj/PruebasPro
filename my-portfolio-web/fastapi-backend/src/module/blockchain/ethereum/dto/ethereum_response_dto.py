"""[ISP] respuesta estructurada del agente Ethereum — contrato mínimo hacia el cliente."""

from typing import Any

from pydantic import BaseModel


class EthereumResponseDto(BaseModel):
    status: str = "success"
    chain: str = "ethereum"
    tool_used: str = ""
    agent_response: str = ""
    tool_result: Any = None
    tx_hash: str | None = None
    gas_used: int | None = None
    network: str = "sepolia"
    explorer_url: str | None = None
    timestamp: str | None = None
