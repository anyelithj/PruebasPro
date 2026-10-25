"""[DRY] helpers internos de Solana — cliente RPC y keypair del agente.

Aísla la creación del AsyncClient y del Keypair para que las @tools no repitan
la lógica de conexión ni el manejo de la clave privada (que nunca se loguea).
"""

from typing import Any

from src.common.constants.blockchain_constants import LAMPORTS_PER_SOL
from src.common.exceptions.blockchain_exception import (
    InvalidAddressException,
    RpcException,
)
from src.config.blockchain_config import get_solana_config


def get_client() -> Any:
    """AsyncClient contra el RPC de Devnet configurado."""
    try:
        from solana.rpc.async_api import AsyncClient
    except ImportError as exc:  # pragma: no cover
        raise RpcException("solana no instalado: `poetry add solana solders`") from exc
    return AsyncClient(get_solana_config().rpc_url)


def get_agent_keypair() -> Any:
    """Keypair del agente desde la clave base58 en .env — nunca se loguea."""
    try:
        from solders.keypair import Keypair
    except ImportError as exc:  # pragma: no cover
        raise RpcException("solders no instalado") from exc
    key = get_solana_config().agent_private_key
    if not key:
        raise RpcException("SOLANA_AGENT_PRIVATE_KEY no configurada")
    return Keypair.from_base58_string(key)


def to_pubkey(address: str) -> Any:
    """Valida y convierte una dirección Base58 a Pubkey."""
    try:
        from solders.pubkey import Pubkey
    except ImportError as exc:  # pragma: no cover
        raise RpcException("solders no instalado") from exc
    try:
        return Pubkey.from_string(address)
    except Exception as exc:  # noqa: BLE001
        raise InvalidAddressException(f"Dirección Solana inválida: {address}") from exc


def lamports_to_sol(lamports: int) -> float:
    return lamports / LAMPORTS_PER_SOL
