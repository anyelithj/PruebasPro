"""[DRY] Pydantic v2 — payload de creación de proyecto."""

from pydantic import BaseModel, Field


class CreateProjectDto(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2000)
    link: str = Field(min_length=1, max_length=500)
    techs: list[str] = Field(default_factory=list, max_length=30)
    featured: bool = False
