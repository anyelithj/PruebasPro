"""[OCP] extiende la forma de create sin modificarla — todos los campos opcionales."""

from pydantic import BaseModel, Field


class UpdateProjectDto(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    link: str | None = Field(default=None, min_length=1, max_length=500)
    techs: list[str] | None = Field(default=None, max_length=30)
    featured: bool | None = None
