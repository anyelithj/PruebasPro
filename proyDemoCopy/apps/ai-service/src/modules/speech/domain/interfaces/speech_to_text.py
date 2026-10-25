"""Puerto de voz a texto.

[Patrón]: Port (Hexagonal) — los casos de uso no conocen faster-whisper.
[Principio]: DIP + ISP (un método).
[Paradigma]: POO estructural (`Protocol`) + Value Objects inmutables (`dataclass(frozen=True)`).
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class WordStamp:
    """Palabra con su marca de tiempo (segundos desde el inicio de la grabación)."""

    word: str
    start: float
    end: float


@dataclass(frozen=True)
class Transcript:
    text: str
    language: str
    duration: float
    words: tuple[WordStamp, ...]  # `tuple` → inmutable


class SpeechToText(Protocol):
    model: str  # Modelo usado (tiny, base…) → trazabilidad

    async def transcribe(self, audio: bytes, language: str | None) -> Transcript: ...
