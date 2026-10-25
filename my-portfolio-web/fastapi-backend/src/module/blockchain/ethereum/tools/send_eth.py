"""@tool[SRP] transfiere sETH desde la wallet del agente al visitante (Sepolia)."""

from langchain_core.tools import tool

from src.common.exceptions.blockchain_exception import TransactionException
from src.module.blockchain.ethereum.tools._eth_client import (
    get_agent_account,
    get_web3,
    to_checksum,
)

_TRANSFER_GAS = 21_000


@tool
async def send_eth(to_address: str, amount_eth: float) -> dict:
    """Envía sETH desde la wallet de prueba del agente a la dirección del visitante.

    Args:
        to_address: dirección 0x destino.
        amount_eth: cantidad de sETH a enviar.
    """
    recipient = to_checksum(to_address)
    account = get_agent_account()
    w3 = get_web3()
    try:
        nonce = await w3.eth.get_transaction_count(account.address)
        gas_price = await w3.eth.gas_price
        chain_id = await w3.eth.chain_id
        tx = {
            "to": recipient,
            "value": w3.to_wei(amount_eth, "ether"),
            "gas": _TRANSFER_GAS,
            "gasPrice": gas_price,
            "nonce": nonce,
            "chainId": chain_id,
        }
        signed = account.sign_transaction(tx)
        tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
        return {
            "from": account.address,
            "to": recipient,
            "amount_eth": amount_eth,
            "tx_hash": tx_hash.hex(),
            "network": "sepolia",
        }
    except Exception as exc:  # noqa: BLE001
        raise TransactionException(f"Envío sETH falló: {exc}") from exc
