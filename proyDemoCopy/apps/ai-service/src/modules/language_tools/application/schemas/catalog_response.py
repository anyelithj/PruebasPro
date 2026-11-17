"""Schemas Pydantic v2 — respuestas de GET /language-tools/languages y /accents.

[Patrón]: DTO.
[Principio]: contrato explícito en Swagger (antes `dict` opaco).
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel  # `BaseModel` (Pydantic v2)


class LanguageOut(BaseModel):
    language: str  # Código ISO (en, fr, de…)
    variant: str  # Variante por defecto (p. ej. en-GB)
    voice: str  # Voz de espeak-ng


class AccentOut(BaseModel):
    accent: str  # «uk» | «us»
    variant: str
    voice: str


class AccentsResponse(BaseModel):
    accents: list[AccentOut]
    engine: str  # Motor fonético activo
