"""[DRY] Pydantic v2 — payload público del formulario de contacto."""

from pydantic import BaseModel, EmailStr, Field


class CreateContactDto(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    message: str = Field(min_length=10, max_length=2000)
