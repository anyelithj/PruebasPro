"""Control de calidad del audio sintetizado: ¿es un WAV válido y SUENA?

[Patrón]: Value Object (`WavStats`) + Guard Clause (`ensure_audible`).
[Principio]: SRP (solo mide; no sintetiza ni conoce HTTP) + Fail Fast (nunca se devuelve un audio mudo como si fuera bueno).
[Paradigma]: Funcional (funciones puras sobre bytes).
[Por qué · 2026-10-24]: la respuesta de AULA llegaba como WAV «válido» (empieza por RIFF) pero sin sonido; el único control era la
cabecera RIFF. Ahora se miden las muestras PCM (RMS y pico) y un audio vacío o en silencio se rechaza con 503 → el navegador usa su voz.
"""

import io
import math
import wave
from array import array
from dataclasses import dataclass

from src.modules.language_tools.domain.interfaces.speech_synthesizer import (
    SpeechUnavailableError,
)

# [Umbral]: -60 dBFS (0,001 de la escala completa) — por debajo, el oído no percibe nada con el volumen normal del sistema
SILENCE_RMS = 0.001
# [Mínimo]: 50 ms de muestras; menos que eso es una cabecera sin datos (p. ej. un WAV truncado al leer de una tubería)
MIN_DURATION_S = 0.05

# `array` (stdlib) por ancho de muestra: código de tipo, desplazamiento (el PCM de 8 bits es sin signo) y escala completa
_PCM = {1: ("B", 128, 128.0), 2: ("h", 0, 32768.0), 4: ("i", 0, 2147483648.0)}


class SilentAudioError(SpeechUnavailableError):
    """El motor respondió, pero el audio está vacío, corrupto o en silencio → 503 (el cliente usa otra voz)."""

    code = "SILENT_AUDIO"


@dataclass(frozen=True)  # `frozen=True`: Value Object inmutable
class WavStats:
    sample_rate: int
    channels: int
    frames: int
    rms: float  # 0..1 (proporción de la escala completa)
    peak: float  # 0..1

    @property
    def duration_s(self) -> float:
        return self.frames / self.sample_rate if self.sample_rate else 0.0


def inspect_wav(data: bytes) -> WavStats:
    """Lee la cabecera y las muestras PCM de un WAV y mide su energía | lanza SilentAudioError si no se puede leer."""
    try:
        # `wave` (stdlib): parsea RIFF/fmt/data; `io.BytesIO` evita escribir en disco
        with wave.open(io.BytesIO(data), "rb") as w:
            width, channels, rate = w.getsampwidth(), w.getnchannels(), w.getframerate()
            raw = w.readframes(w.getnframes())  # Si la cabecera exagera el tamaño, devuelve solo lo que hay
    except (wave.Error, EOFError) as exc:
        raise SilentAudioError(f"Audio de voz inválido: {exc}") from exc
    if width not in _PCM:
        raise SilentAudioError(f"Audio de voz con muestras de {width} bytes (no es PCM 8/16/32)")
    code, offset, full = _PCM[width]
    samples = array(code, raw[: len(raw) - len(raw) % width])  # Recorta un byte suelto final (WAV truncado)
    if not samples:
        return WavStats(rate, channels, 0, 0.0, 0.0)
    # [RMS]: raíz de la media de los cuadrados → energía media; [pico]: muestra más alta → detecta audio casi mudo
    energy = sum((s - offset) ** 2 for s in samples)
    rms = math.sqrt(energy / len(samples)) / full
    peak = max(abs(s - offset) for s in samples) / full
    return WavStats(rate, channels, len(samples) // max(channels, 1), rms, peak)


def ensure_audible(data: bytes) -> WavStats:
    """Guard: el audio debe tener muestras y superar el umbral de silencio; si no, error (nunca se devuelve audio mudo)."""
    stats = inspect_wav(data)
    if stats.duration_s < MIN_DURATION_S:
        raise SilentAudioError("El motor de voz devolvió un audio vacío")
    if stats.rms < SILENCE_RMS:
        raise SilentAudioError(
            f"El motor de voz devolvió un audio en silencio (RMS {stats.rms:.5f} < {SILENCE_RMS})"
        )
    return stats
