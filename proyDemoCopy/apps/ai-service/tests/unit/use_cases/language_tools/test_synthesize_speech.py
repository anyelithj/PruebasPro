"""Tests de la voz local (Sprint 4.7): mapa de voces, caso de uso y el adaptador real de espeak-ng."""

import pytest

from src.modules.language_tools.application.schemas.speak_request import SpeakRequest
from src.modules.language_tools.application.use_cases.synthesize_speech import (
    SynthesizeSpeechUseCase,
)
from src.modules.language_tools.domain.language_voices import voice_for
from src.modules.language_tools.infrastructure.clients.espeak_speech import (
    EspeakSpeech,
    espeak_binary,
)
from src.shared.exceptions.custom_errors import ValidationDomainError


class FakeSynth:
    """Doble de prueba del puerto SpeechSynthesizer: guarda lo que recibe."""

    engine = "fake"

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    async def synthesize(self, text: str, voice: str) -> bytes:
        self.calls.append((text, voice))
        return b"RIFF-fake"


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
