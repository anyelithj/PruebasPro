"""WhisperTranscriber — voz a texto local con faster-whisper (MIT), CPU y cuantizado.

[Patrón]: Adapter (implementa SpeechToText) + Lazy Singleton (el modelo se carga una vez por proceso).
[Principio]: SRP + DIP + DRY (lo usan Speech y, más adelante, Alignment).
[Paradigma]: Asíncrono (la inferencia bloqueante corre en un hilo con `asyncio.to_thread`).
[Privacidad]: el audio llega en memoria y se descarta al terminar; nunca se escribe a disco.
"""

import asyncio
import io
from functools import lru_cache

from src.modules.speech.domain.interfaces.speech_to_text import Transcript, WordStamp
from src.shared.config.settings import get_settings
from src.shared.exceptions.custom_errors import ModelInferenceError, ValidationDomainError


@lru_cache(maxsize=1)  # [Lazy Singleton]: cargar el modelo cuesta segundos y RAM → una sola instancia
def _model():  # noqa: ANN202 — tipo de faster_whisper (import diferido para no cargar ctranslate2 al arrancar)
    from faster_whisper import WhisperModel

    s = get_settings()
    return WhisperModel(s.whisper_model, device="cpu", compute_type=s.whisper_compute_type)


def _transcribe_sync(audio: bytes, language: str | None) -> Transcript:
    try:
        # `word_timestamps=True`: marca de tiempo por palabra → métricas de fluidez · `vad_filter`: ignora silencios largos
        segments, info = _model().transcribe(io.BytesIO(audio), language=language, word_timestamps=True, vad_filter=True)
        words = tuple(
            WordStamp(word=w.word.strip(), start=round(w.start, 2), end=round(w.end, 2))
            for seg in segments  # `segments` es un generador: la inferencia ocurre al recorrerlo
            for w in (seg.words or [])
            if w.word.strip()
        )
    except ValueError as exc:  # Formato de audio no reconocido por PyAV
        raise ValidationDomainError(f"Audio no válido: {exc}") from exc
    except Exception as exc:  # noqa: BLE001 — cualquier fallo del modelo → 503 (el cliente puede reintentar)
        raise ModelInferenceError(f"No se pudo transcribir: {exc}") from exc
    return Transcript(
        text=" ".join(w.word for w in words), language=info.language, duration=round(info.duration, 2), words=words
    )


class WhisperTranscriber:
    @property
    def model(self) -> str:
        return f"faster-whisper {get_settings().whisper_model}"

    async def transcribe(self, audio: bytes, language: str | None) -> Transcript:
        return await asyncio.to_thread(_transcribe_sync, audio, language)


def get_speech_to_text() -> WhisperTranscriber:
    """Dependency de FastAPI (el modelo es compartido gracias al lru_cache)."""
    return WhisperTranscriber()
