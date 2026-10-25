# email_parser_schema.py (Pydantic v2) => contratos del analizador de correos.
# Patrón: DTO + Schema (model_validator: regla entre campos). Paradigma: declarativo.

from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ParseRequest => correo crudo RFC 822 ("raw") o asunto/cuerpo sueltos
class ParseRequest(BaseModel):
    raw: str | None = Field(default=None, max_length=200_000)
    subject: str = Field(default="", max_length=255)
    body: str = Field(default="", max_length=50_000)
    sender: str = Field(default="", max_length=255)

    @model_validator(mode="after")  # Valida la combinación de campos después de los tipos
    def require_content(self) -> Self:
        if not self.raw and not self.body.strip():
            raise ValueError("Envía 'raw' (correo completo) o 'body'")
        return self


class EntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    label: str
    text: str
    start: int
    end: int


class ParsedEmailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    subject: str
    sender: str
    excerpt: str
    intent: str
    intent_score: float
    entities: list[EntityResponse]
    created_at: datetime


# ExtractedEntityItem => fila de GET /extracted (incluye el correo de origen)
class ExtractedEntityItem(EntityResponse):
    email_id: str
