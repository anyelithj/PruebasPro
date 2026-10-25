"""[STRATEGY] catálogo de @tools Solana que el LLM puede invocar.

`get_solana_tools()` se llama de forma perezosa al construir el agente, de modo
que langchain_core/solana solo se importan cuando el módulo blockchain se usa.
"""

from typing import Any


def get_solana_tools() -> list[Any]:
    from src.module.blockchain.solana.tools.get_sol_balance import get_sol_balance
    from src.module.blockchain.solana.tools.get_tx_history import get_tx_history
    from src.module.blockchain.solana.tools.mint_cnft import mint_cnft
    from src.module.blockchain.solana.tools.request_airdrop import request_airdrop
    from src.module.blockchain.solana.tools.transfer_sol import transfer_sol

    return [
        get_sol_balance,
        request_airdrop,
        transfer_sol,
        mint_cnft,
        get_tx_history,
    ]
