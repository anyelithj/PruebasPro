"""Tests Sprint 9.4: tiempos por línea (función pura) y alineación real (espeak-ng → WAV → faster-whisper).

[Patrón]: AAA + prueba de extremo a extremo local.
"""

import pytest

from src.modules.alignment.application.schemas.align_request import AlignRequest
from src.modules.alignment.application.use_cases.align_lines import AlignLinesUseCase
from src.modules.alignment.domain.text_matching import align
from src.modules.language_tools.infrastructure.clients.espeak_speech import EspeakSpeech, espeak_binary
from src.modules.speech.domain.interfaces.speech_to_text import WordStamp
from src.shared.clients.whisper_transcriber import WhisperTranscriber
from src.shared.exceptions.custom_errors import ValidationDomainError


def stamps(*items: tuple[str, float, float]) -> tuple[WordStamp, ...]:
    return tuple(WordStamp(*i) for i in items)


def test_cada_linea_toma_inicio_y_fin_de_sus_palabras():
    heard = stamps(("Hello,", 0.1, 0.4), ("there.", 0.5, 0.8), ("How", 1.5, 1.7), ("are", 1.8, 1.9), ("you?", 2.0, 2.3))
    out = align(["Hello there", "How are you?"], heard)
    assert (out[0].start, out[0].end, out[0].confidence) == (0.1, 0.8, 1.0)
    assert (out[1].start, out[1].end) == (1.5, 2.3)


def test_linea_no_reconocida_ocupa_el_hueco_con_confianza_cero():
    heard = stamps(("one", 0.0, 0.5), ("three", 3.0, 3.5))
    out = align(["one", "two", "three"], heard)
    assert (out[1].start, out[1].end, out[1].confidence) == (0.5, 3.0, 0.0)


def test_palabra_mal_oida_baja_la_confianza_sin_perder_la_linea():
    out = align(["good morning my friend"], stamps(("good", 0.0, 0.2), ("mourning", 0.3, 0.6), ("my", 0.7, 0.8), ("friend", 0.9, 1.2)))
    assert out[0].start == 0.0 and out[0].end == 1.2 and out[0].confidence == 0.75


async def test_rechaza_audio_vacio():
    with pytest.raises(ValidationDomainError):
        await AlignLinesUseCase(WhisperTranscriber(), 10).execute(b"", AlignRequest(lines=["a"], language="en"))


@pytest.mark.skipif(espeak_binary() is None, reason="espeak-ng no instalado")
async def test_alineacion_real_de_un_dialogo_y_cancion_solo_propone():
    audio = await EspeakSpeech().synthesize("good morning. how are you today?", "en-us")
    uc = AlignLinesUseCase(WhisperTranscriber(), 10 * 1024 * 1024)
    res = await uc.execute(audio, AlignRequest(lines=["Good morning.", "How are you today?"], language="en"))
    first, second = res.lines
    assert first.start is not None and second.start is not None and first.end <= second.start + 0.01
    assert not res.proposed
    song = await uc.execute(audio, AlignRequest(lines=["Good morning."], language="en", kind="song"))
    assert song.proposed  # [RF-119]: en canciones los tiempos son solo una propuesta
