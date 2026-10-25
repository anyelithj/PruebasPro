"""Schemas Pydantic v2 — POST /language-tools/lines (letras de canciones y diálogos).

[Patrón]: DTO inmutable.
[Principio]: Fail Fast (máx. 80 líneas) + ISP.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel, ConfigDict, Field

from src.modules.language_tools.domain.language_voices import LanguageCode


class LinesRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    lines: list[str] = Field(..., min_length=1, max_length=80)
    language: LanguageCode


class EnrichedLine(BaseModel):
    index: int
    text: str
    translation: str | None  # None si el contenido ya está en español
    ipa: str  # Variante por defecto del idioma (en: en-GB)
    ipa_us: str | None = None  # [Sprint 9.1]: solo inglés → el interruptor UK/US del karaoke no necesita otra consulta


class LinesResponse(BaseModel):
    lines: list[EnrichedLine]
    engine: str
    # [Sprint 9.1]: chino mandarín (tonos) y ruso (acento) → el IPA de espeak-ng necesita revisión de un hablante nativo
    needs_native_review: bool = False
