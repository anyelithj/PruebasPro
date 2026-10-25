"""Puerto del sintetizador de voz local.

[Patrón]: Port (Hexagonal) — el caso de uso no conoce espeak-ng; cambiar de motor = nuevo adaptador.
[Principio]: DIP + ISP (un solo método).
[Paradigma]: POO estructural (`Protocol`, sin herencia).
"""

from typing import Protocol

from src.shared.exceptions.custom_errors import DomainError


class SpeechUnavailableError(DomainError):
    """El motor de voz no está instalado o no respondió → 503 (el cliente puede reintentar más tarde)."""

    status_code = 503


class SpeechSynthesizer(Protocol):
    """Contrato: texto + voz → audio WAV en bytes."""

    engine: str  # Motor y versión (p. ej. "espeak-ng") → forma parte de la clave de caché del backend

    async def synthesize(self, text: str, voice: str) -> bytes: ...
