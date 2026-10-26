"""Tests Sprint 8.6: métricas de fluidez (función pura) y transcripción real (espeak-ng → WAV → faster-whisper).

[Patrón]: AAA + prueba de extremo a extremo local (sin red salvo la primera descarga del modelo).
"""

from importlib.util import find_spec

import pytest

from src.modules.language_tools.infrastructure.clients.espeak_speech import EspeakSpeech, espeak_binary
from src.modules.speech.application.schemas.fluency_request import FluencyRequest
from src.modules.speech.application.schemas.transcribe_response import WordStampOut
from src.modules.speech.application.use_cases.analyze_fluency import AnalyzeFluencyUseCase
from src.modules.speech.application.use_cases.transcribe_audio import TranscribeAudioUseCase
from src.modules.speech.domain.fluency_metrics import compute_fluency
from src.shared.clients.whisper_transcriber import WhisperTranscriber
from src.shared.exceptions.custom_errors import ValidationDomainError


def w(word: str, start: float, end: float) -> WordStampOut:
    return WordStampOut(word=word, start=start, end=end)


def test_metricas_pausas_racha_ppm_y_vocabulario():
    words = [w("I", 1.0, 1.2), w("like", 1.3, 1.6), w("apples.", 1.7, 2.0), w("Bananas", 3.0, 3.5), w("too", 3.6, 4.0)]
    m = compute_fluency(words, prompt_end_s=0.5, pause_threshold_s=0.6, target_vocabulary=["apples", "pears"])
    assert m.time_to_respond_s == 0.5  # 1.0 − 0.5
    assert m.pauses == 1  # 2.0 → 3.0
    assert m.longest_run_s == 1.0  # 1.0 → 2.0
    assert m.words_produced == 5 and m.words_per_minute == 100.0  # 5 palabras en 3 s
    assert m.reused_vocabulary == ("apples",) and m.reuse_ratio == 0.5


def test_metricas_sin_palabras_y_umbral_por_defecto():
    assert compute_fluency([]).words_produced == 0
    res = AnalyzeFluencyUseCase(0.6).execute(FluencyRequest(words=[w("hi", 0.2, 0.4)]))
    assert res.words_produced == 1 and res.pauses == 0


async def test_transcribir_rechaza_vacio_y_demasiado_grande():
    uc = TranscribeAudioUseCase(WhisperTranscriber(), max_bytes=10)
    with pytest.raises(ValidationDomainError):
        await uc.execute(b"", "en")
    with pytest.raises(ValidationDomainError):
        await uc.execute(b"x" * 11, "en")


@pytest.mark.skipif(espeak_binary() is None, reason="espeak-ng no instalado")
# [2026-10-25]: sin faster-whisper en el venv se omite (la ausencia la cubre test_speech_engine_missing.py)
@pytest.mark.skipif(find_spec("faster_whisper") is None, reason="faster-whisper no instalado")
async def test_transcripcion_real_con_marcas_por_palabra():
    audio = await EspeakSpeech().synthesize("good morning my friend", "en-us")
    res = await TranscribeAudioUseCase(WhisperTranscriber(), max_bytes=10 * 1024 * 1024).execute(audio, "en")
    said = res.text.lower()
    assert "morning" in said and "friend" in said
    assert res.words and all(x.end >= x.start for x in res.words)
