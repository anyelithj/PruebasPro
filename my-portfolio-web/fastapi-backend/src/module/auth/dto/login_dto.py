"""[DRY][CC-N] email + password."""

from pydantic import BaseModel, EmailStr, Field


class LoginDto(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
