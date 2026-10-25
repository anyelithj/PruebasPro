"""Schema Pydantic v2 — request de POST /language-tools/speak.

[Patrón]: DTO inmutable.
[Principio]: Fail Fast (valida en la frontera) + ISP.
[Paradigma]: Declarativo.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SpeakRequest(BaseModel):
    """Texto a pronunciar en un idioma y variante."""

    model_config = ConfigDict(
        frozen=True, extra="forbid"
    )  # Inmutable y sin campos desconocidos

    text: str = Field(
        ..., min_length=1, max_length=300, description="Palabra o frase corta"
    )
    language: Literal[
        "en", "fr", "de", "es", "pt", "zh", "ru"
    ]  # `Literal` (typing): los 7 idiomas de la plataforma
    variant: str | None = Field(
        default=None,
        pattern=r"^[a-z]{2}-[A-Z0-9]{2,3}$",
        description="BCP-47, p. ej. en-GB",
    )
