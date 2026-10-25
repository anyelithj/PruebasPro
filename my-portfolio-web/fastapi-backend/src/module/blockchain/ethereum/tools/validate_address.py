"""@tool[SRP] valida si un string es una dirección Ethereum válida (EIP-55)."""

from langchain_core.tools import tool

from src.common.exceptions.blockchain_exception import InvalidAddressException
from src.module.blockchain.ethereum.tools._eth_client import to_checksum


@tool
async def validate_address(address: str) -> dict:
    """Verifica si una dirección Ethereum es válida y devuelve su forma checksum.

    Args:
        address: string a validar como dirección 0x.
    """
    try:
        checksummed = to_checksum(address)
        return {"address": address, "valid": True, "checksum": checksummed}
    except InvalidAddressException:
        return {"address": address, "valid": False, "checksum": None}
