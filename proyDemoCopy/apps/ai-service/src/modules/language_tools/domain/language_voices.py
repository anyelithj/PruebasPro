"""Idioma y variante regional → voz de espeak-ng.

[Patrón]: Lookup Table (SSOT de voces).
[Principio]: SRP + OCP (nueva variante = nueva entrada, sin tocar el código que la usa).
[Paradigma]: Funcional (funciones puras).
[Regla del producto]: la pronunciación siempre declara su variante (en-GB ≠ en-US); nunca se asume una universal.
"""

from types import MappingProxyType
from typing import Literal

from src.shared.exceptions.custom_errors import ValidationDomainError

# [Sprint 8.1]: los 7 idiomas de la plataforma (espejo de packages/shared-schemas LANGUAGES) · `Literal` (typing) → Pydantic valida en la frontera
LanguageCode = Literal["en", "fr", "de", "es", "pt", "zh", "ru"]
Accent = Literal["uk", "us"]  # Interruptor UK/US: solo aplica al inglés
ACCENT_VARIANT = MappingProxyType({"uk": "en-GB", "us": "en-US"})

# [Variante por defecto]: la misma que usa el backend para la IPA (DEFAULT_VARIANT de NestJS) | `MappingProxyType` (stdlib): dict de solo lectura
DEFAULT_VARIANT = MappingProxyType(
    {
        "en": "en-GB",
        "fr": "fr-FR",
        "de": "de-DE",
        "es": "es-ES",
        "pt": "pt-BR",
        "zh": "zh-CN",
        "ru": "ru-RU",
    }
)

# [Variante BCP-47 → voz de espeak-ng 1.52]: verificadas con `espeak-ng --voices` (todas devuelven WAV)
VOICES = MappingProxyType(
    {
        "en-GB": "en-gb",
        "en-US": "en-us",
        "fr-FR": "fr-fr",
        "de-DE": "de",
        "es-ES": "es",
        "es-419": "es-419",  # Español de América Latina
        "pt-BR": "pt-br",
        "pt-PT": "pt",
        "zh-CN": "cmn",  # Chino mandarín
        "ru-RU": "ru",
    }
)


def voice_for(language: str, variant: str | None = None) -> tuple[str, str]:
    """Devuelve (variante usada, voz de espeak-ng). Lanza 422 si el idioma o la variante no están soportados."""
    chosen = variant or DEFAULT_VARIANT.get(
        language
    )  # `or` (Python): variante pedida o la del idioma
    if (
        chosen is None
        or chosen not in VOICES
        or not chosen.lower().startswith(language)
    ):
        raise ValidationDomainError(
            f"Variante de voz no soportada: idioma={language} variante={variant}"
        )
    return chosen, VOICES[chosen]


def ipa_voices(language: str) -> dict[str, str]:
    """Voces para IPA: inglés → {"uk": en-gb, "us": en-us}; resto → {"default": voz del idioma}. [Paradigma]: función pura."""
    if language == "en":
        return {accent: VOICES[variant] for accent, variant in ACCENT_VARIANT.items()}
    return {"default": voice_for(language)[1]}

