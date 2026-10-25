"""Caso de uso: transcribir una grabación con marcas de tiempo por palabra.

[Patrón]: Use Case (Command) + Port (SpeechToText).
[Principio]: SRP + DIP + Fail Fast (tamaño máximo antes de cargar el modelo).
[Paradigma]: POO + asíncrono.
"""

from src.modules.speech.application.schemas.transcribe_response import TranscribeResponse, WordStampOut
from src.modules.speech.domain.interfaces.speech_to_text import SpeechToText
from src.shared.exceptions.custom_errors import ValidationDomainError


class TranscribeAudioUseCase:
    def __init__(self, stt: SpeechToText, max_bytes: int) -> None:
        self._stt = stt
        self._max = max_bytes

    async def execute(self, audio: bytes, language: str | None) -> TranscribeResponse:
        if not audio:
            raise ValidationDomainError("La grabación está vacía")
        if len(audio) > self._max:
            raise ValidationDomainError(f"La grabación supera el máximo de {self._max // (1024 * 1024)} MB")
        t = await self._stt.transcribe(audio, language)
        return TranscribeResponse(
            text=t.text,
            language=t.language,
            duration=t.duration,
            words=[WordStampOut(word=w.word, start=w.start, end=w.end) for w in t.words],
            model=self._stt.model,
        )
