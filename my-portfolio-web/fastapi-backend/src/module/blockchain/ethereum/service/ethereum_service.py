"""[FACADE][SRP] lógica del agente Ethereum — construye el agente y expone stream/invoke."""

from collections.abc import AsyncGenerator
from typing import Any

from src.common.enums.blockchain_enum import ChainType
from src.common.exceptions.blockchain_exception import ChainDisabledException
from src.config.blockchain_config import get_ethereum_config, is_chain_enabled
from src.module.blockchain.agent.agent_runner import invoke_agent, stream_agent_events
from src.module.blockchain.agent.blockchain_agent import create_blockchain_agent
from src.module.blockchain.ethereum.dto.ethereum_response_dto import EthereumResponseDto
from src.module.blockchain.ethereum.tools import get_ethereum_tools


class EthereumService:
    def _build_agent(self) -> Any:
        if not is_chain_enabled(ChainType.ETHEREUM):
            raise ChainDisabledException("El agente Ethereum está deshabilitado")
        return create_blockchain_agent(ChainType.ETHEREUM, get_ethereum_tools())

    def _compose_message(self, message: str, wallet: str | None) -> str:
        if wallet:
            return f"{message}\n\n[dirección del visitante: {wallet}]"
        return message

    async def stream(
        self, message: str, wallet: str | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        agent = self._build_agent()
        async for event in stream_agent_events(
            agent, self._compose_message(message, wallet)
        ):
            yield event

    async def invoke(
        self, message: str, wallet: str | None = None
    ) -> EthereumResponseDto:
        agent = self._build_agent()
        result = await invoke_agent(agent, self._compose_message(message, wallet))
        cfg = get_ethereum_config()
        tx_hash = _extract_tx_hash(result.get("tool_result"))
        return EthereumResponseDto(
            status=result.get("status", "success"),
            tool_used=result.get("tool_used", ""),
            agent_response=result.get("agent_response", ""),
            tool_result=result.get("tool_result"),
            tx_hash=tx_hash,
            network=cfg.network,
            explorer_url=(f"{cfg.explorer_base}/tx/{tx_hash}" if tx_hash else None),
            timestamp=result.get("timestamp"),
        )


def _extract_tx_hash(tool_result: Any) -> str | None:
    if isinstance(tool_result, dict):
        return tool_result.get("tx_hash")
    return None
