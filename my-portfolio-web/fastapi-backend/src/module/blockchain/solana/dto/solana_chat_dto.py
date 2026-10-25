"""[DRY] entrada del agente Solana — mensaje + wallet opcional del visitante."""

from pydantic import BaseModel, Field


class SolanaChatDto(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    wallet_address: str | None = Field(default=None, max_length=64)
