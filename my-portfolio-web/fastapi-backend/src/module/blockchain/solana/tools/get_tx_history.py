"""@tool[SRP] últimas transacciones de una wallet Solana, en lenguaje sencillo."""

from langchain_core.tools import tool

from src.common.constants.blockchain_constants import MAX_TX_HISTORY
from src.module.blockchain.solana.tools._solana_client import get_client, to_pubkey


@tool
async def get_tx_history(wallet: str) -> dict:
    """Devuelve las últimas transacciones de una wallet Solana para explicarlas.

    Args:
        wallet: dirección pública Base58 de la wallet.
    """
    pubkey = to_pubkey(wallet)
    client = get_client()
    try:
        resp = await client.get_signatures_for_address(pubkey, limit=MAX_TX_HISTORY)
        txs = [
            {
                "signature": str(item.signature),
                "slot": item.slot,
                "err": item.err is not None,
                "block_time": item.block_time,
            }
            for item in resp.value
        ]
        return {"wallet": wallet, "count": len(txs), "transactions": txs}
    finally:
        await client.close()
