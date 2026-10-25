"""Schemas Pydantic v2 — POST /language-tools/ipa.

[Patrón]: DTO inmutable.
[Principio]: Fail Fast + ISP.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel, ConfigDict, Field

from src.modules.language_tools.domain.language_voices import Accent, LanguageCode


class IpaRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    text: str = Field(..., min_length=1, max_length=500)
    language: LanguageCode
    accent: Accent | None = None  # Solo inglés; None → ambos acentos


class WordIpa(BaseModel):
    word: str
    ipa: str


class IpaResult(BaseModel):
    """IPA de una variante: por palabra y completo."""

    variant: str  # BCP-47 (en-GB, en-US, fr-FR…)
    full: str
    words: list[WordIpa]


class IpaResponse(BaseModel):
    results: dict[str, IpaResult]  # "uk"/"us" en inglés · "default" en el resto
    engine: str  # Motor y versión (la salida cambia entre versiones)
