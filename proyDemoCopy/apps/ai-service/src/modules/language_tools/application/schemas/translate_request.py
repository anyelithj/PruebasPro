"""Schemas Pydantic v2 — POST /language-tools/translate.

[Patrón]: DTO inmutable.
[Principio]: Fail Fast (valida en la frontera) + ISP.
[Paradigma]: Declarativo.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from src.modules.language_tools.domain.language_voices import LanguageCode

# [Detectar idioma · 2026-10-27]: «auto» = el servidor detecta el idioma de origen (Traductor, como Google Translate)
SourceLanguage = LanguageCode | Literal["auto"]
TextKind = Literal["frase", "titulo", "expresion"]  # Mismos valores que «tipo_de_texto» del Anexo A  # `|` (PEP 604) sobre tipos `Literal`: Pydantic acepta los 7 códigos o «auto»


class TranslateRequest(BaseModel):
    """Término o frase a traducir (por defecto al español)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    text: str = Field(..., min_length=1, max_length=500)
    source: SourceLanguage
    target: LanguageCode = "es"
    # [2026-11-13 · Caso C]: «titulo» y «expresion» no se traducen palabra por palabra → opciones natural, cercana y literal
    tipo_de_texto: TextKind = "frase"
    # [2026-11-13]: conversación previa (no se traduce; aclara el sentido) | no entra en la caché: misma frase → misma traducción
    context: str = Field(default="", max_length=600)


class TranslationOption(BaseModel):
    tipo: Literal["natural", "cercana", "literal"]
    texto: str


class TranslateResponse(BaseModel):
    translation: str  # En títulos/expresiones = la opción recomendada (natural)
    alternatives: list[str] = Field(default_factory=list, max_length=3)  # Alternativas cortas
    tone: Literal["formal", "informal", "neutral"] = "neutral"  # Registro cuando aplica (tú/usted, tu/vous…)
    model: str  # Modelo que tradujo (trazabilidad; "" = sin traducción porque origen = destino)
    detected_language: LanguageCode | None = None
    references: list[str] = Field(default_factory=list)  # [Tarea 9 · RNF-35]: ids de los fragmentos (frases/expresiones) del RAG usados como guía
    options: list[TranslationOption] = Field(default_factory=list, max_length=3)  # [Caso C]: natural (recomendada), cercana y literal · vacío en «frase»  # [2026-10-27]: idioma detectado si se pidió source="auto" (la UI muestra «Detectado: Inglés»)
