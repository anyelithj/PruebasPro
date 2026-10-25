"""[OCP] extiende la forma de create sin modificarla — todos los campos opcionales."""

from pydantic import BaseModel, EmailStr, Field


class UpdateUserDto(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    is_active: bool | None = None
