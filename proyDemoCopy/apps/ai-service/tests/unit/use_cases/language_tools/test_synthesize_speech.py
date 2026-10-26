"""Tests de la voz local (Sprint 4.7): mapa de voces, caso de uso y el adaptador real de espeak-ng.

[2026-10-24]: + control de silencio (RMS) — la respuesta de AULA llegaba como WAV válido pero mudo.
"""

import io
import math
import struct
import wave

import pytest

from src.modules.language_tools.application.schemas.speak_request import SpeakRequest
from src.modules.language_tools.application.use_cases.synthesize_speech import (
    SynthesizeSpeechUseCase,
)
from src.modules.language_tools.domain.audio_quality import (
    SilentAudioError,
    ensure_audible,
    inspect_wav,
)
from src.modules.language_tools.domain.language_voices import voice_for
from src.modules.language_tools.infrastructure.clients.espeak_speech import (
    EspeakSpeech,
    espeak_binary,
)
from src.shared.exceptions.custom_errors import ValidationDomainError


def make_wav(amplitude: float, seconds: float = 0.5, rate: int = 22050) -> bytes:
    """WAV PCM 16 bits mono con un tono de 440 Hz (`amplitude` 0..1; 0 = silencio) | `wave` (stdlib) escribe la cabecera correcta."""
    frames = b"".join(
        struct.pack("<h", int(amplitude * 32767 * math.sin(2 * math.pi * 440 * i / rate)))
        for i in range(int(seconds * rate))
    )
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(frames)
    return buf.getvalue()


class FakeSynth:
    """Doble de prueba del puerto SpeechSynthesizer: guarda lo que recibe y devuelve el audio configurado."""

    engine = "fake"

    def __init__(self, audio: bytes | None = None) -> None:
        self.calls: list[tuple[str, str]] = []
        self.audio = make_wav(0.5) if audio is None else audio

    async def synthesize(self, text: str, voice: str) -> bytes:
        self.calls.append((text, voice))
        return self.audio


class TestAudioQuality:
    def test_mide_rms_y_pico_de_un_tono(self) -> None:
        stats = inspect_wav(make_wav(0.5))
        assert (stats.sample_rate, stats.channels) == (22050, 1)
        assert stats.duration_s == pytest.approx(0.5)
        assert stats.peak == pytest.approx(0.5, abs=0.01)
        assert stats.rms == pytest.approx(0.5 / math.sqrt(2), abs=0.01)  # RMS de una senoide = pico/√2

    @pytest.mark.parametrize(
        "audio",
        [
            make_wav(0.0),  # Silencio digital (todas las muestras a 0)
            make_wav(0.0005),  # Por debajo de -60 dBFS: inaudible
            make_wav(0.5, seconds=0.0),  # Cabecera sin muestras
            b"RIFF-fake",  # Empieza por RIFF pero no es un WAV
            b"",
        ],
    )
    def test_rechaza_audio_vacio_mudo_o_corrupto(self, audio: bytes) -> None:
        with pytest.raises(SilentAudioError) as exc:
            ensure_audible(audio)
        assert exc.value.status_code == 503  # El backend lo traduce a 503 y el navegador usa su voz

    def test_tolera_la_cabecera_de_stdout_con_tamanos_exagerados(self) -> None:
        """Regresión: `espeak-ng --stdout` deja 0x7FFFF000 en RIFF/data; las muestras reales se siguen midiendo."""
        audio = bytearray(make_wav(0.3))
        struct.pack_into("<I", audio, 4, 0x7FFFF024)
        struct.pack_into("<I", audio, 40, 0x7FFFF000)
        assert ensure_audible(bytes(audio)).duration_s == pytest.approx(0.5)


class TestVoices:
    def test_variante_por_defecto_y_explicita(self) -> None:
        assert voice_for("en") == ("en-GB", "en-gb")
        assert voice_for("en", "en-US") == ("en-US", "en-us")
        assert voice_for("zh") == ("zh-CN", "cmn")

    def test_rechaza_variante_de_otro_idioma_o_desconocida(self) -> None:
        with pytest.raises(ValidationDomainError):
            voice_for("en", "pt-BR")  # La variante no corresponde al idioma
        with pytest.raises(ValidationDomainError):
            voice_for("fr", "fr-CA")  # Variante sin voz configurada


class TestSynthesizeSpeech:
    async def test_usa_la_voz_de_la_variante_y_limpia_el_texto(self) -> None:
        synth = FakeSynth()
        result = await SynthesizeSpeechUseCase(synth).execute(
            SpeakRequest(text="  water ", language="en")
        )
        assert synth.calls == [("water", "en-gb")]
        assert (result.variant, result.voice, result.engine) == (
            "en-GB",
            "en-gb",
            "fake",
        )

    async def test_no_devuelve_audio_en_silencio(self) -> None:
        with pytest.raises(SilentAudioError):
            await SynthesizeSpeechUseCase(FakeSynth(make_wav(0.0))).execute(
                SpeakRequest(text="That's great!", language="en", variant="en-US")
            )

    def test_el_schema_rechaza_idiomas_fuera_de_la_plataforma(self) -> None:
        with pytest.raises(ValueError):
            SpeakRequest(text="hola", language="it")


@pytest.mark.skipif(
    espeak_binary() is None, reason="espeak-ng no instalado (CI sin motor de voz)"
)
class TestEspeakReal:
    async def test_genera_wav_en_los_7_idiomas(self) -> None:
        engine = EspeakSpeech()
        for language in ["en", "fr", "de", "es", "pt", "zh", "ru"]:
            _, voice = voice_for(language)
            audio = await engine.synthesize("hola", voice)
            assert audio.startswith(b"RIFF") and len(audio) > 1000
            assert ensure_audible(audio).rms > 0.01  # Suena de verdad (no solo cabecera)

    async def test_la_respuesta_de_aula_suena_y_la_cabecera_es_exacta(self) -> None:
        """Regresión 2026-10-24: frase real de AULA → WAV PCM 16 bits con tamaños RIFF/data reales y energía audible."""
        audio = await EspeakSpeech().synthesize(
            "That's great! What do you like about Mexican food?", "en-us"
        )
        riff, data = struct.unpack_from("<I", audio, 4)[0], struct.unpack_from("<I", audio, 40)[0]
        assert riff == len(audio) - 8 and data == len(audio) - 44  # Antes: 0x7FFFF024 / 0x7FFFF000
        stats = ensure_audible(audio)
        assert stats.duration_s > 1 and stats.peak > 0.1

    async def test_un_texto_con_guion_inicial_no_se_interpreta_como_opcion(
        self,
    ) -> None:
        audio = await EspeakSpeech().synthesize(
            "--version", "en-gb"
        )  # Entra por stdin: se pronuncia, no ejecuta la opción
        assert audio.startswith(b"RIFF")

    def test_funciona_con_selector_event_loop(self) -> None:
        """Regresión: uvicorn --reload en Windows usa SelectorEventLoop (sin subprocesos asyncio)."""
        import asyncio

        loop = asyncio.SelectorEventLoop()
        try:
            audio = loop.run_until_complete(EspeakSpeech().synthesize("water", "en-gb"))
        finally:
            loop.close()
        assert audio.startswith(b"RIFF")
