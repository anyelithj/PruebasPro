"""[DRY][CC-N] token del enlace + contraseña nueva."""

from pydantic import BaseModel, Field


class ResetPasswordDto(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=128)
