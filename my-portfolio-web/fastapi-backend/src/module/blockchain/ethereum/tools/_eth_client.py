"""[DRY] helpers internos de Ethereum — AsyncWeb3 y cuenta del agente.

La clave privada del agente se lee desde .env y nunca se loguea.
"""

from typing import Any

from src.common.exceptions.blockchain_exception import (
    InvalidAddressException,
    RpcException,
)
from src.config.blockchain_config import get_ethereum_config


def get_web3() -> Any:
    """AsyncWeb3 contra el RPC de Sepolia configurado."""
    try:
        from web3 import AsyncWeb3
    except ImportError as exc:  # pragma: no cover
        raise RpcException("web3 no instalado: `poetry add web3 eth-account`") from exc
    return AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(get_ethereum_config().rpc_url))


def get_agent_account() -> Any:
    """Cuenta del agente desde la clave hex en .env — nunca se loguea."""
    try:
        from eth_account import Account
    except ImportError as exc:  # pragma: no cover
        raise RpcException("eth-account no instalado") from exc
    key = get_ethereum_config().agent_private_key
    if not key:
        raise RpcException("ETH_AGENT_PRIVATE_KEY no configurada")
    return Account.from_key(key)


def to_checksum(address: str) -> str:
    """Valida y normaliza una dirección a checksum EIP-55."""
    try:
        from web3 import Web3
    except ImportError as exc:  # pragma: no cover
        raise RpcException("web3 no instalado") from exc
    if not Web3.is_address(address):
        raise InvalidAddressException(f"Dirección Ethereum inválida: {address}")
    return Web3.to_checksum_address(address)
