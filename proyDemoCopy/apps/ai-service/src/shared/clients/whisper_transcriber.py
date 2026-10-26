"""WhisperTranscriber — voz a texto local con faster-whisper (MIT), CPU y cuantizado.

[Patrón]: Adapter (implementa SpeechToText) + Lazy Singleton (el modelo se carga una vez por proceso).
[Principio]: SRP + DIP + DRY (lo usan Speech y, más adelante, Alignment).
[Paradigma]: Asíncrono (la inferencia bloqueante corre en un hilo con `asyncio.to_thread`).
[Privacidad]: el audio llega en memoria y se descarta al terminar; nunca se escribe a disco.
[2026-10-25]: distingue «motor no instalado» (SPEECH_ENGINE_MISSING) de «falló la inferencia» (MODEL_INFERENCE_ERROR)
y expone el estado del motor para /health y /speech/status.
"""

import asyncio
import importlib
import io
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from src.modules.speech.domain.interfaces.speech_to_text import Transcript, WordStamp
from src.shared.config.settings import get_settings
from src.shared.exceptions.custom_errors import (
    ModelInferenceError,
    SpeechEngineUnavailableError,
    ValidationDomainError,
)

logger = logging.getLogger("ai-service.speech")

ENGINE = "faster-whisper"
# [Mensaje accionable]: lo lee el admin en logs, /health y la respuesta 503 | [Principio]: SSOT (un solo texto)
INSTALL_HINT = "Instala faster-whisper: pip install -r requirements.txt (en el venv del ai-service) y reinicia el servicio"
_FALLBACK_COMPUTE_TYPE = "default"  # [CTranslate2]: elige el tipo más eficiente que soporte la CPU (int8 → float32 si no hay AVX2/VNNI)
_warned = False  # [Log una vez]: evita repetir el mismo WARNING en cada petición mientras falte la dependencia


@dataclass(frozen=True)
class SpeechEngineStatus:
    """Estado del motor de voz a texto. [Patrón]: Value Object inmutable (`frozen=True`)."""

    available: bool
    engine: str
    model: str
    compute_type: str
    reason: str | None = None  # Causa técnica (p. ej. «No module named 'faster_whisper'» o un DLL que no carga en Windows)
    hint: str | None = None  # Qué hacer para arreglarlo


def _warn_once(exc: BaseException) -> None:
    """WARNING único por proceso cuando el motor no importa. [Principio]: logs sin ruido."""
    global _warned  # noqa: PLW0603 — bandera de módulo deliberada (estado del proceso, no de la petición)
    if not _warned:
        _warned = True
        logger.warning("Voz a texto NO disponible (%s). %s", exc, INSTALL_HINT)


def _import_whisper_model() -> Any:  # noqa: ANN401 — clase de faster_whisper (import diferido: ctranslate2 tarda en cargar)
    """Importa `WhisperModel` o lanza SpeechEngineUnavailableError.

    `ImportError` cubre `ModuleNotFoundError` (paquete ausente) y «DLL load failed» de ctranslate2 en Windows
    (falta el Visual C++ Redistributable o no hay wheel para esa versión de Python).
    """
    try:
        return importlib.import_module("faster_whisper").WhisperModel  # `import_module`: si falló antes, reintenta (no queda cacheado)
    except ImportError as exc:
        _warn_once(exc)
        raise SpeechEngineUnavailableError(f"El motor de voz a texto no está instalado ({exc}). {INSTALL_HINT}") from exc


def speech_engine_status() -> SpeechEngineStatus:
    """Sonda del motor (sin cargar el modelo): ¿se puede importar faster-whisper? [Principio]: Fail Fast + observabilidad."""
    s = get_settings()
    base = {"engine": ENGINE, "model": s.whisper_model, "compute_type": s.whisper_compute_type}
    try:
        _import_whisper_model()
    except SpeechEngineUnavailableError as exc:
        return SpeechEngineStatus(available=False, reason=str(exc.__cause__), hint=INSTALL_HINT, **base)
    return SpeechEngineStatus(available=True, **base)


@lru_cache(maxsize=1)  # [Lazy Singleton]: cargar el modelo cuesta segundos y RAM → una sola instancia (las excepciones no se cachean)
def _model():  # noqa: ANN202 — tipo de faster_whisper
    whisper_model = _import_whisper_model()
    s = get_settings()
    try:
        return whisper_model(s.whisper_model, device="cpu", compute_type=s.whisper_compute_type)
    except ValueError as exc:
        # [Windows/CPU antiguas]: «Requested int8 compute type, but the target device or backend do not support…»
        # → se reintenta con el tipo que la CPU soporte en vez de dejar la voz caída | [Patrón]: Graceful Degradation
        logger.warning("compute_type=%s no soportado (%s); se usa '%s'", s.whisper_compute_type, exc, _FALLBACK_COMPUTE_TYPE)
        return whisper_model(s.whisper_model, device="cpu", compute_type=_FALLBACK_COMPUTE_TYPE)


def _load_model():  # noqa: ANN202
    """Modelo listo o error tipado: motor ausente → 503 SPEECH_ENGINE_MISSING; descarga/carga fallida → 503 MODEL_INFERENCE_ERROR."""
    try:
        return _model()
    except SpeechEngineUnavailableError:
        raise
    except Exception as exc:  # noqa: BLE001 — sin red en la primera descarga, disco lleno, modelo corrupto…
        s = get_settings()
        raise ModelInferenceError(
            f"No se pudo cargar el modelo de voz «{s.whisper_model}»: {exc}. "
            "La primera vez se descarga de Hugging Face (requiere conexión)"
        ) from exc


def _transcribe_sync(audio: bytes, language: str | None) -> Transcript:
    model = _load_model()  # Fuera del try de inferencia: un fallo de carga no se confunde con «audio no válido»
    try:
        # `word_timestamps=True`: marca de tiempo por palabra → métricas de fluidez · `vad_filter`: ignora silencios largos
        segments, info = model.transcribe(io.BytesIO(audio), language=language, word_timestamps=True, vad_filter=True)
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
        return f"{ENGINE} {get_settings().whisper_model}"

    async def transcribe(self, audio: bytes, language: str | None) -> Transcript:
        return await asyncio.to_thread(_transcribe_sync, audio, language)


def get_speech_to_text() -> WhisperTranscriber:
    """Dependency de FastAPI (el modelo es compartido gracias al lru_cache)."""
    return WhisperTranscriber()
