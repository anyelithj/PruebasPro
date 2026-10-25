"""@tool[SRP] balance SOL + tokens SPL de cualquier wallet pública Solana."""

from langchain_core.tools import tool

from src.module.blockchain.solana.tools._solana_client import (
    get_client,
    lamports_to_sol,
    to_pubkey,
)


@tool
async def get_sol_balance(wallet: str) -> dict:
    """Consulta el balance de SOL y tokens SPL de una wallet pública de Solana.

    Args:
        wallet: dirección pública Base58 de la wallet a consultar.
    """
    pubkey = to_pubkey(wallet)
    client = get_client()
    try:
        resp = await client.get_balance(pubkey)
        lamports = resp.value
        # Tokens SPL: cuentas de token propiedad de la wallet.
        spl_tokens: list[dict] = []
        try:
            from solana.rpc.types import TokenAccountOpts
            from solders.pubkey import Pubkey

            token_program = Pubkey.from_string(
                "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
            )
            accounts = await client.get_token_accounts_by_owner(
                pubkey, TokenAccountOpts(program_id=token_program)
            )
            spl_tokens = [{"account": str(a.pubkey)} for a in accounts.value]
        except Exception:  # noqa: BLE001 — SPL es best-effort
            spl_tokens = []
        return {
            "wallet": wallet,
            "sol_balance": lamports_to_sol(lamports),
            "spl_tokens": spl_tokens,
        }
    finally:
        await client.close()
