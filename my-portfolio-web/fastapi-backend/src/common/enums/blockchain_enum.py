"""[CC-N] valores semánticos del dominio blockchain — no strings mágicos."""

from enum import StrEnum


class ChainType(StrEnum):
    """Cadena soportada por el agente blockchain."""

    SOLANA = "solana"
    ETHEREUM = "ethereum"


class TxStatus(StrEnum):
    """Estado de una transacción on-chain."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"
