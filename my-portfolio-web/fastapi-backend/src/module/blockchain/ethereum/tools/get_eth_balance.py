"""@tool[SRP] balance ETH + tokens ERC-20 de cualquier dirección 0x en Sepolia."""

from langchain_core.tools import tool

from src.common.constants.blockchain_constants import WEI_PER_ETH
from src.module.blockchain.ethereum.tools._eth_client import get_web3, to_checksum


@tool
async def get_eth_balance(address: str) -> dict:
    """Consulta el balance de sETH de una dirección Ethereum en Sepolia.

    Args:
        address: dirección 0x a consultar.
    """
    checksummed = to_checksum(address)
    w3 = get_web3()
    wei = await w3.eth.get_balance(checksummed)
    return {
        "address": checksummed,
        "eth_balance": wei / WEI_PER_ETH,
        "network": "sepolia",
    }
