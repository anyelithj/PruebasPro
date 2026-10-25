"""[DRY] entrada del agente Ethereum — mensaje + dirección opcional del visitante."""

from pydantic import BaseModel, Field


class EthereumChatDto(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    wallet_address: str | None = Field(default=None, max_length=64)
