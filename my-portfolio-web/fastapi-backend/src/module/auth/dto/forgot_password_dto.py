"""[DRY][CC-N] solo email."""

from pydantic import BaseModel, EmailStr


class ForgotPasswordDto(BaseModel):
    email: EmailStr
