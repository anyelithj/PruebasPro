"""Schemas Pydantic v2 — POST /language-tools/translate.

[Patrón]: DTO inmutable.
[Principio]: Fail Fast (valida en la frontera) + ISP.
[Paradigma]: Declarativo.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from src.modules.language_tools.domain.language_voices import LanguageCode


class TranslateRequest(BaseModel):
    """Término o frase a traducir (por defecto al español)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    text: str = Field(..., min_length=1, max_length=500)
    source: LanguageCode
    target: LanguageCode = "es"


class TranslateResponse(BaseModel):
    translation: str
    alternatives: list[str] = Field(default_factory=list, max_length=3)  # Alternativas cortas
    tone: Literal["formal", "informal", "neutral"] = "neutral"  # Registro cuando aplica (tú/usted, tu/vous…)
    model: str  # Modelo que tradujo (trazabilidad; "" = sin traducción porque origen = destino)
