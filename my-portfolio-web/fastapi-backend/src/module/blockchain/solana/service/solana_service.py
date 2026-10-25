"""[FACADE][SRP] lógica del agente Solana — construye el agente y expone stream/invoke.

No toca HTTP. Verifica que la cadena esté habilitada antes de operar.
"""

from collections.abc import AsyncGenerator
from typing import Any

from src.common.enums.blockchain_enum import ChainType
from src.common.exceptions.blockchain_exception import ChainDisabledException
from src.config.blockchain_config import get_solana_config, is_chain_enabled
from src.module.blockchain.agent.agent_runner import invoke_agent, stream_agent_events
from src.module.blockchain.agent.blockchain_agent import create_blockchain_agent
from src.module.blockchain.solana.dto.solana_response_dto import SolanaResponseDto
from src.module.blockchain.solana.tools import get_solana_tools


class SolanaService:
    def _build_agent(self) -> Any:
        if not is_chain_enabled(ChainType.SOLANA):
            raise ChainDisabledException("El agente Solana está deshabilitado")
        return create_blockchain_agent(ChainType.SOLANA, get_solana_tools())

    def _compose_message(self, message: str, wallet: str | None) -> str:
        if wallet:
            return f"{message}\n\n[wallet del visitante: {wallet}]"
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
    ) -> SolanaResponseDto:
        agent = self._build_agent()
        result = await invoke_agent(agent, self._compose_message(message, wallet))
        cfg = get_solana_config()
        tx_sig = _extract_tx_signature(result.get("tool_result"))
        return SolanaResponseDto(
            status=result.get("status", "success"),
            tool_used=result.get("tool_used", ""),
            agent_response=result.get("agent_response", ""),
            tool_result=result.get("tool_result"),
            tx_signature=tx_sig,
            network=cfg.network,
            explorer_url=(
                f"{cfg.explorer_base}&tx={tx_sig}" if tx_sig else None
            ),
            timestamp=result.get("timestamp"),
        )


def _extract_tx_signature(tool_result: Any) -> str | None:
    if isinstance(tool_result, dict):
        return tool_result.get("tx_signature")
    return None
