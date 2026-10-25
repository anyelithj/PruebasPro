"""@tool[SRP] airdrop de SOL de prueba en Devnet para demostración."""

from langchain_core.tools import tool

from src.common.constants.blockchain_constants import (
    DEFAULT_AIRDROP_SOL,
    LAMPORTS_PER_SOL,
)
from src.common.exceptions.blockchain_exception import TransactionException
from src.module.blockchain.solana.tools._solana_client import get_client, to_pubkey


@tool
async def request_airdrop(wallet: str, amount_sol: float = DEFAULT_AIRDROP_SOL) -> dict:
    """Solicita un airdrop de SOL de prueba en Devnet a la wallet indicada.

    Args:
        wallet: dirección pública Base58 que recibirá el SOL de prueba.
        amount_sol: cantidad de SOL a solicitar (por defecto 1.0).
    """
    pubkey = to_pubkey(wallet)
    client = get_client()
    try:
        lamports = int(amount_sol * LAMPORTS_PER_SOL)
        resp = await client.request_airdrop(pubkey, lamports)
        signature = str(resp.value)
        return {
            "wallet": wallet,
            "amount_sol": amount_sol,
            "tx_signature": signature,
            "network": "devnet",
        }
    except Exception as exc:  # noqa: BLE001
        raise TransactionException(f"Airdrop falló: {exc}") from exc
    finally:
        await client.close()
