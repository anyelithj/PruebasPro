"""[DRY] Pydantic v2 — payload de creación de usuario."""

from pydantic import BaseModel, EmailStr, Field

from src.common.enums.role_enum import Role


class CreateUserDto(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role = Role.USER
