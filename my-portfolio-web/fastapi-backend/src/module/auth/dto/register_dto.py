"""[DRY][CC-N] name + email + password."""

from pydantic import BaseModel, EmailStr, Field


class RegisterDto(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
