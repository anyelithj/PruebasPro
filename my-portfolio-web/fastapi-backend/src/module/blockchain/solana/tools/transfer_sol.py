"""@tool[SRP] transfiere SOL desde la wallet del agente al visitante (Devnet)."""

from langchain_core.tools import tool

from src.common.constants.blockchain_constants import LAMPORTS_PER_SOL
from src.common.exceptions.blockchain_exception import TransactionException
from src.module.blockchain.solana.tools._solana_client import (
    get_agent_keypair,
    get_client,
    to_pubkey,
)


@tool
async def transfer_sol(to_wallet: str, amount_sol: float) -> dict:
    """Envía SOL desde la wallet de prueba del agente a la wallet del visitante.

    Args:
        to_wallet: dirección pública Base58 destino.
        amount_sol: cantidad de SOL a transferir.
    """
    recipient = to_pubkey(to_wallet)
    keypair = get_agent_keypair()
    client = get_client()
    try:
        from solders.system_program import TransferParams, transfer
        from solders.transaction import Transaction

        lamports = int(amount_sol * LAMPORTS_PER_SOL)
        ix = transfer(
            TransferParams(
                from_pubkey=keypair.pubkey(),
                to_pubkey=recipient,
                lamports=lamports,
            )
        )
        blockhash = (await client.get_latest_blockhash()).value.blockhash
        tx = Transaction([keypair], [ix], blockhash)  # type: ignore[call-arg]
        resp = await client.send_transaction(tx)
        return {
            "from": str(keypair.pubkey()),
            "to": to_wallet,
            "amount_sol": amount_sol,
            "tx_signature": str(resp.value),
            "network": "devnet",
        }
    except Exception as exc:  # noqa: BLE001
        raise TransactionException(f"Transferencia SOL falló: {exc}") from exc
    finally:
        await client.close()
