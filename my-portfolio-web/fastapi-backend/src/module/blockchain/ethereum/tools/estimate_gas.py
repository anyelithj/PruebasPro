"""@tool[SRP] estima el costo de gas en Gwei para una transferencia en Sepolia."""

from langchain_core.tools import tool

from src.module.blockchain.ethereum.tools._eth_client import get_web3, to_checksum

_TRANSFER_GAS = 21_000  # gas fijo de una transferencia ETH simple


@tool
async def estimate_gas(to_address: str, amount_eth: float = 0.01) -> dict:
    """Calcula el costo de gas (Gwei) de enviar ETH a una dirección en Sepolia.

    Args:
        to_address: dirección 0x destino.
        amount_eth: cantidad de ETH a transferir (para la estimación).
    """
    to_checksum(to_address)
    w3 = get_web3()
    gas_price_wei = await w3.eth.gas_price
    gas_price_gwei = w3.from_wei(gas_price_wei, "gwei")
    total_wei = gas_price_wei * _TRANSFER_GAS
    return {
        "gas_limit": _TRANSFER_GAS,
        "gas_price_gwei": float(gas_price_gwei),
        "estimated_cost_eth": float(w3.from_wei(total_wei, "ether")),
        "network": "sepolia",
    }
