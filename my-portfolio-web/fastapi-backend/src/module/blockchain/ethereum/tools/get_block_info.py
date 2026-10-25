"""@tool[SRP] info del último bloque minado en Sepolia."""

from langchain_core.tools import tool

from src.module.blockchain.ethereum.tools._eth_client import get_web3


@tool
async def get_block_info() -> dict:
    """Devuelve datos del último bloque minado: número, timestamp, txs, gas."""
    w3 = get_web3()
    block = await w3.eth.get_block("latest")
    return {
        "number": block["number"],
        "timestamp": block["timestamp"],
        "tx_count": len(block["transactions"]),
        "gas_used": block["gasUsed"],
        "gas_limit": block["gasLimit"],
        "miner": block.get("miner"),
        "network": "sepolia",
    }
