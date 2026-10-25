"""[STRATEGY] catálogo de @tools Ethereum Sepolia que el LLM puede invocar."""

from typing import Any


def get_ethereum_tools() -> list[Any]:
    from src.module.blockchain.ethereum.tools.estimate_gas import estimate_gas
    from src.module.blockchain.ethereum.tools.get_block_info import get_block_info
    from src.module.blockchain.ethereum.tools.get_eth_balance import get_eth_balance
    from src.module.blockchain.ethereum.tools.send_eth import send_eth
    from src.module.blockchain.ethereum.tools.validate_address import validate_address

    return [
        get_eth_balance,
        estimate_gas,
        send_eth,
        get_block_info,
        validate_address,
    ]
