"""Tests Sprint 8.1: traducción (LLM falso), IPA determinista (espeak-ng real), lookup, palabra y líneas.

[Patrón]: Test Double (FakeLlm) + AAA.
[Principio]: el IPA nunca depende del LLM → con el LLM caído sigue saliendo.
"""

import json

import pytest

from src.modules.language_tools.application.schemas.ipa_request import IpaRequest
from src.modules.language_tools.application.schemas.lines_request import LinesRequest
from src.modules.language_tools.application.schemas.translate_request import TranslateRequest
from src.modules.language_tools.application.schemas.word_request import WordRequest
from src.modules.language_tools.application.use_cases.enrich_lines import EnrichLinesUseCase
from src.modules.language_tools.application.use_cases.lookup_term import LookupTermUseCase
from src.modules.language_tools.application.use_cases.lookup_word import LookupWordUseCase
from src.modules.language_tools.application.use_cases.transcribe_ipa import TranscribeIpaUseCase, split_words
from src.modules.language_tools.application.use_cases.translate_text import UNAVAILABLE, TranslateTextUseCase
from src.modules.language_tools.infrastructure.clients.espeak_phonetizer import EspeakPhonetizer
from src.modules.language_tools.infrastructure.clients.espeak_speech import espeak_binary


class FakeLlm:
    def __init__(self, reply: dict | None) -> None:
        self.reply = reply
        self.calls = 0

    async def generate(self, prompt: str, **_: object) -> str:
        self.calls += 1
        if self.reply is None:
            raise RuntimeError("Ollama caído")
        return json.dumps(self.reply)


needs_espeak = pytest.mark.skipif(espeak_binary() is None, reason="espeak-ng no instalado")


def test_split_words_quita_signos_y_respeta_chino():
    assert split_words("Hello, world!", "en") == ["Hello", "world"]
    assert split_words("你好世界", "zh") == ["你好世界"]


async def test_translate_mismo_idioma_no_llama_al_llm():
    llm = FakeLlm({"translation": "x"})
    res = await TranslateTextUseCase(llm, "m").execute(TranslateRequest(text="hola", source="es", target="es"))
    assert res.translation == "hola" and llm.calls == 0


async def test_translate_llm_caido_devuelve_unavailable():
    res = await TranslateTextUseCase(FakeLlm(None), "m").execute(TranslateRequest(text="water", source="en"))
    assert res.translation == "" and res.model == UNAVAILABLE


@needs_espeak
async def test_ipa_ingles_trae_uk_y_us_por_palabra():
    res = await TranscribeIpaUseCase(EspeakPhonetizer()).execute(IpaRequest(text="water bottle", language="en"))
    assert set(res.results) == {"uk", "us"}
    assert [w.word for w in res.results["uk"].words] == ["water", "bottle"]
    assert res.results["uk"].full != res.results["us"].full  # wˈɔːtə ≠ wˈɑːɾɚ
    assert res.engine.startswith("espeak-ng 1.52")


@needs_espeak
async def test_lookup_trae_traduccion_e_ipa_aunque_el_llm_falle():
    ipa = TranscribeIpaUseCase(EspeakPhonetizer())
    ok = await LookupTermUseCase(
        TranslateTextUseCase(FakeLlm({"translation": "agua", "alternatives": ["el agua"], "register": "neutral"}), "m"), ipa
    ).execute(TranslateRequest(text="water", source="en"))
    assert ok.translation.translation == "agua" and ok.ipa_uk and ok.ipa_us and ok.ipa is None
    down = await LookupTermUseCase(TranslateTextUseCase(FakeLlm(None), "m"), ipa).execute(
        TranslateRequest(text="Bonjour", source="fr")
    )
    assert down.translation.model == UNAVAILABLE and down.ipa  # IPA determinista sigue


@needs_espeak
async def test_palabra_en_contexto_y_lineas():
    ipa = TranscribeIpaUseCase(EspeakPhonetizer())
    word = await LookupWordUseCase(
        FakeLlm({"lemma": "run", "translation": "corriendo", "examples": ["I run.", "She runs.", "extra"]}), ipa
    ).execute(WordRequest(word="running", sentence="He is running", language="en"))
    assert word.lemma == "run" and len(word.examples) == 2 and word.ipa_us
    lines = await EnrichLinesUseCase(TranslateTextUseCase(FakeLlm({"translation": "hola"}), "m"), EspeakPhonetizer()).execute(
        LinesRequest(lines=["Hello there", "Good night"], language="en")
    )
    assert [ln.translation for ln in lines.lines] == ["hola", "hola"] and all(ln.ipa for ln in lines.lines)
    # [Sprint 9.1]: inglés trae IPA UK y US por línea; ruso y chino se marcan para revisión nativa; español sin traducción
    assert all(ln.ipa_us for ln in lines.lines) and lines.lines[0].ipa_us != lines.lines[0].ipa and not lines.needs_native_review
    ru = await EnrichLinesUseCase(TranslateTextUseCase(FakeLlm({"translation": "hola"}), "m"), EspeakPhonetizer()).execute(
        LinesRequest(lines=["Привет"], language="ru")
    )
    assert ru.needs_native_review and ru.lines[0].ipa and ru.lines[0].ipa_us is None
    es = await EnrichLinesUseCase(TranslateTextUseCase(FakeLlm({"translation": "x"}), "m"), EspeakPhonetizer()).execute(
        LinesRequest(lines=["Buenos días"], language="es")
    )
    assert es.lines[0].translation is None


@needs_espeak
async def test_ipa_completo_no_corta_la_ultima_silaba():
    assert (await EspeakPhonetizer().ipa("umbrella", "en-gb")) == "ʌmbɹˈɛlə"


async def test_lines_traduce_en_un_solo_lote():
    # [2026-10-23]: todas las líneas en UNA llamada (antes una por línea y algunas quedaban sin traducción)
    llm = FakeLlm({"translations": ["¡Genial!", "¿A qué hora almuerzas?"]})
    out = await EnrichLinesUseCase(TranslateTextUseCase(llm, "m"), EspeakPhonetizer()).execute(LinesRequest(language="en", lines=["Great!", "What time do you have lunch?"]))
    assert [x.translation for x in out.lines] == ["¡Genial!", "¿A qué hora almuerzas?"] and llm.calls == 1


# ───── 2026-10-24 · IPA de francés: lote alineado, caché y resultado parcial (nunca 503 por una palabra) ─────
class _FlakyPhonetizer:
    """Doble: el texto completo falla (timeout) y una palabra queda sin IPA → la respuesta es parcial, no 503."""

    engine = "fake"

    async def ipa(self, text: str, voice: str) -> str:
        from src.modules.language_tools.domain.interfaces.speech_synthesizer import SpeechUnavailableError

        raise SpeechUnavailableError("El fonetizador no respondió a tiempo")

    async def ipa_words(self, words: list[str], voice: str) -> list[str]:
        return ["mɛzɔ̃" if w == "maison" else "" for w in words]


async def test_ipa_parcial_si_falla_el_texto_completo():
    res = await TranscribeIpaUseCase(_FlakyPhonetizer()).execute(IpaRequest(text="maison xyz", language="fr"))
    assert res.results["default"].full == "mɛzɔ̃"
    assert [w.ipa for w in res.results["default"].words] == ["mɛzɔ̃", ""]


@needs_espeak
async def test_ipa_frances_lote_alineado_con_signos_y_cache(monkeypatch):
    from src.modules.language_tools.infrastructure.clients import espeak_phonetizer as mod

    mod._CACHE.clear()
    calls = {"n": 0}
    real = mod._run

    def counting(args, text):  # Cuenta procesos espeak-ng lanzados
        calls["n"] += 1
        return real(args, text)

    monkeypatch.setattr(mod, "_run", counting)
    ph = EspeakPhonetizer()
    items = ["Bonjour, ça va?", "—", "week-end", "aujourd'hui", "la maison"]
    out = await ph.ipa_words(items, "fr-fr")
    assert len(out) == len(items) and out[1] == "" and all(out[i] for i in (0, 2, 3, 4))
    assert "(en)" not in out[2]  # Sin marcas de cambio de idioma
    assert calls["n"] == 1  # Un solo proceso para todo el lote (antes: uno por palabra en serie)
    await ph.ipa_words(items, "fr-fr")
    assert calls["n"] == 1  # Segunda vez: todo sale de la caché LRU
