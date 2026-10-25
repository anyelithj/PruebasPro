"""[DRY][CC-N] refresh token en el cuerpo."""

from pydantic import BaseModel, Field


class RefreshTokenDto(BaseModel):
    refresh_token: str = Field(min_length=1)
