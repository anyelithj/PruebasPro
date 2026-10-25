"""Caso de uso: calcular el inicio y el fin de cada línea de una letra o un diálogo (Sprint 9.4).

[Patrón]: Use Case (Command) + Port (SpeechToText, el mismo WhisperTranscriber de Speech).
[Principio]: SRP + DIP + DRY (reutiliza el transcriptor compartido) + Fail Fast (tamaño máximo antes de cargar el modelo).
[Paradigma]: POO + asíncrono; el cálculo de tiempos es una función pura (domain/text_matching.py).
"""

from src.modules.alignment.application.schemas.align_request import AlignRequest
from src.modules.alignment.application.schemas.align_response import AlignResponse, LineTimingOut
from src.modules.alignment.domain.text_matching import align
from src.modules.speech.domain.interfaces.speech_to_text import SpeechToText
from src.shared.exceptions.custom_errors import ValidationDomainError


class AlignLinesUseCase:
    def __init__(self, stt: SpeechToText, max_bytes: int) -> None:
        self._stt = stt
        self._max = max_bytes

    async def execute(self, audio: bytes, req: AlignRequest) -> AlignResponse:
        if not audio:
            raise ValidationDomainError("El audio está vacío")
        if len(audio) > self._max:
            raise ValidationDomainError(f"El audio supera el máximo de {self._max // (1024 * 1024)} MB")
        transcript = await self._stt.transcribe(audio, req.language)
        return AlignResponse(
            lines=[LineTimingOut(**t.__dict__) for t in align(req.lines, transcript.words)],
            kind=req.kind,
            proposed=req.kind == "song",
            duration=transcript.duration,
            model=self._stt.model,
        )
