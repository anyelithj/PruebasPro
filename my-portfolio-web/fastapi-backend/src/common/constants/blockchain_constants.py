"""[DRY] literales blockchain en un solo lugar — redes, tokens conocidos, límites."""

from typing import Final

# Lamports por SOL (10^9) — evita el número mágico disperso.
LAMPORTS_PER_SOL: Final[int] = 1_000_000_000

# Wei por ETH (10^18).
WEI_PER_ETH: Final[int] = 10**18

# Máximo de transacciones que get_tx_history explica en lenguaje natural.
MAX_TX_HISTORY: Final[int] = 5

# Airdrop por defecto en Devnet (en SOL).
DEFAULT_AIRDROP_SOL: Final[float] = 1.0

# Tokens SPL conocidos en Devnet (symbol -> mint address).
KNOWN_SPL_TOKENS: Final[dict[str, str]] = {
    "USDC": "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
}

# Tokens ERC-20 conocidos en Sepolia (symbol -> contract address).
KNOWN_ERC20_TOKENS: Final[dict[str, str]] = {
    "USDC": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
}

# Nombres canónicos de las @tools — usados en el JSON estructurado hacia NestJS.
TOOL_GET_SOL_BALANCE: Final[str] = "get_sol_balance"
TOOL_REQUEST_AIRDROP: Final[str] = "request_airdrop"
TOOL_TRANSFER_SOL: Final[str] = "transfer_sol"
TOOL_MINT_CNFT: Final[str] = "mint_cnft"
TOOL_GET_TX_HISTORY: Final[str] = "get_tx_history"

TOOL_GET_ETH_BALANCE: Final[str] = "get_eth_balance"
TOOL_ESTIMATE_GAS: Final[str] = "estimate_gas"
TOOL_SEND_ETH: Final[str] = "send_eth"
TOOL_GET_BLOCK_INFO: Final[str] = "get_block_info"
TOOL_VALIDATE_ADDRESS: Final[str] = "validate_address"
