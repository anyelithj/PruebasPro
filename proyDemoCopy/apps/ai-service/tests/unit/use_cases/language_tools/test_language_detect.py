"""Tests 2026-10-27: «Detectar idioma» (Traductor y Corrector) — detector determinista y source="auto" en /translate y /lookup.

[Patrón]: Test Double (FakeLlm, FakeIpa) + AAA + tabla parametrizada.
[Principio]: sin LLM ni red; la detección nunca lanza.
"""

import json

import pytest

from src.modules.language_tools.application.schemas.ipa_request import IpaResponse
from src.modules.language_tools.application.schemas.translate_request import TranslateRequest
from src.modules.language_tools.application.use_cases.lookup_term import LookupTermUseCase
from src.modules.language_tools.application.use_cases.translate_text import TranslateTextUseCase
from src.shared.domain.language_detect import detect_language, resolve_language


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("hello", "en"),
        ("She go to school every days.", "en"),
        ("Hola, ¿cómo estás?", "es"),
        ("Me gusta la comida mexicana", "es"),
        ("Bonjour tout le monde", "fr"),
        ("Je allez au cinéma", "fr"),
        ("Guten Morgen, wie geht es dir?", "de"),
        ("Obrigado pela ajuda", "pt"),
        ("Привет, как дела?", "ru"),
        ("你好世界", "zh"),
        # [Fix 2026-10-28]: empates y frases cortas de principiante ya no caen en el idioma por defecto
        ("mi nombre es ana", "es"),
        ("me llamo Ana", "es"),
        ("tengo un perro", "es"),
        ("i m ana", "en"),
    ],
)
def test_detecta_los_7_idiomas(text, expected):
    assert detect_language(text).language == expected


def test_sin_evidencia_devuelve_idioma_por_defecto_sin_lanzar():
    d = detect_language("12345 !!")
    assert d.language == "en" and d.confidence < 0.5


def test_resolve_language_solo_detecta_con_auto():
    assert resolve_language("fr", "Hola amigo") == ("fr", None)
    assert resolve_language("auto", "Hola amigo, ¿qué tal?") == ("es", "es")


class FakeLlm:
    def __init__(self, reply: dict) -> None:
        self.reply, self.prompts = reply, []

    async def generate(self, prompt: str, **_: object) -> str:
        self.prompts.append(prompt)
        return json.dumps(self.reply)


async def test_translate_auto_detecta_y_lo_devuelve():
    llm = FakeLlm({"translation": "Me gusta el café por la mañana.", "alternatives": [], "register": "neutral"})
    res = await TranslateTextUseCase(llm, "m").execute(TranslateRequest(text="I like coffee in the morning.", source="auto"))
    assert res.detected_language == "en" and res.translation.startswith("Me gusta")
    assert "del inglés" in llm.prompts[0]  # La cadena trabaja con el código detectado, no con «auto»


async def test_translate_auto_mismo_idioma_que_destino_no_llama_al_llm():
    llm = FakeLlm({"translation": "x"})
    res = await TranslateTextUseCase(llm, "m").execute(TranslateRequest(text="Hola, ¿cómo estás?", source="auto", target="es"))
    assert res.translation == "Hola, ¿cómo estás?" and res.detected_language == "es" and not llm.prompts


async def test_translate_con_idioma_explicito_no_informa_deteccion():
    res = await TranslateTextUseCase(FakeLlm({}), "m").execute(TranslateRequest(text="yes", source="en"))
    assert res.detected_language is None


def test_request_rechaza_idiomas_fuera_de_alcance():
    with pytest.raises(ValueError):
        TranslateRequest(text="ciao", source="it")


class FakeIpa:
    def __init__(self) -> None:
        self.languages: list[str] = []

    async def execute(self, req) -> IpaResponse:
        self.languages.append(req.language)
        return IpaResponse(results={}, engine="fake")


async def test_lookup_auto_resuelve_antes_del_ipa():
    ipa = FakeIpa()
    translate = TranslateTextUseCase(FakeLlm({}), "m")
    res = await LookupTermUseCase(translate, ipa).execute(TranslateRequest(text="Danke", source="auto"))  # type: ignore[arg-type]
    assert ipa.languages == ["de"] and res.language == "de" and res.detected_language == "de"
