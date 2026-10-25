"""[DDD] registro en BD de cada interacción con el agente Solana."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database.base_model import BaseModel
from src.infrastructure.database.types import GUID


class SolanaInteractionModel(BaseModel):
    __tablename__ = "solana_interactions"

    message: Mapped[str] = mapped_column(Text, nullable=False)
    wallet_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tool_used: Mapped[str | None] = mapped_column(String(40), nullable=True)
    tx_signature: Mapped[str | None] = mapped_column(String(128), nullable=True)
    user_id: Mapped[str | None] = mapped_column(GUID(), index=True, nullable=True)
