"""[SRP] configuración blockchain — RPC URLs, redes y referencias a claves privadas.

Las claves privadas NUNCA se hardcodean: se leen desde .env (en .gitignore) vía Settings.
Este módulo solo re-expone valores tipados; no imprime ni loguea secretos.
"""

from dataclasses import dataclass

from src.common.enums.blockchain_enum import ChainType
from src.config.settings import settings


@dataclass(frozen=True)
class SolanaConfig:
    enabled: bool
    rpc_url: str
    network: str
    agent_private_key: str  # base58 — nunca se loguea

    @property
    def explorer_base(self) -> str:
        return f"https://explorer.solana.com/?cluster={self.network}"


@dataclass(frozen=True)
class EthereumConfig:
    enabled: bool
    rpc_url: str
    network: str
    agent_private_key: str  # hex 0x — nunca se loguea

    @property
    def explorer_base(self) -> str:
        return f"https://{self.network}.etherscan.io"


def get_solana_config() -> SolanaConfig:
    return SolanaConfig(
        enabled=settings.enable_solana_agent,
        rpc_url=settings.solana_rpc_url,
        network=settings.solana_network,
        agent_private_key=settings.solana_agent_private_key,
    )


def get_ethereum_config() -> EthereumConfig:
    return EthereumConfig(
        enabled=settings.enable_ethereum_agent,
        rpc_url=settings.eth_rpc_url,
        network=settings.eth_network,
        agent_private_key=settings.eth_agent_private_key,
    )


def is_chain_enabled(chain: ChainType) -> bool:
    if chain is ChainType.SOLANA:
        return settings.enable_solana_agent
    if chain is ChainType.ETHEREUM:
        return settings.enable_ethereum_agent
    return False
