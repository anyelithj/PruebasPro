"""Schemas Pydantic v2 — POST /language-tools/word (palabra dentro de su frase).

[Patrón]: DTO inmutable.
[Principio]: Fail Fast + ISP.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel, ConfigDict, Field

from src.modules.language_tools.domain.language_voices import LanguageCode


class WordRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    word: str = Field(..., min_length=1, max_length=60)
    sentence: str = Field(default="", max_length=400)  # Frase donde aparece → traducción según el contexto
    language: LanguageCode
    target: LanguageCode = "es"


class WordResponse(BaseModel):
    word: str
    lemma: str | None = None  # Forma de diccionario si el LLM la determina
    translation: str
    ipa_uk: str | None = None
    ipa_us: str | None = None
    ipa: str | None = None
    examples: list[str] = Field(default_factory=list, max_length=2)  # Hasta dos ejemplos breves
    engine: str
