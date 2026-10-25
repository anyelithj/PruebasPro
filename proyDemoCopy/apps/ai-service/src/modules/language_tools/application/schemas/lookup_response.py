"""Schema Pydantic v2 — respuesta de POST /language-tools/lookup.

[Patrón]: DTO (agrega traducción + IPA en una sola respuesta).
[Principio]: ISP — el interruptor UK/US del cliente no necesita otra consulta.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel

from src.modules.language_tools.application.schemas.translate_request import TranslateResponse


class LookupResponse(BaseModel):
    text: str
    language: str
    translation: TranslateResponse
    ipa_uk: str | None = None  # Solo inglés
    ipa_us: str | None = None  # Solo inglés
    ipa: str | None = None  # Resto de idiomas (una sola variante)
    engine: str
