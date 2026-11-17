"""[Fix 2026-10-30]: la tarjeta de palabra muestra el significado de la PALABRA, nunca la frase traducida.

[Patrón]: Test Double (LLM con respuestas en cola + IPA falso) + AAA.
"""

import json
from types import SimpleNamespace

from src.modules.language_tools.application.schemas.word_request import WordRequest
from src.modules.language_tools.application.use_cases.lookup_word import LookupWordUseCase


class FakeLlm:
    def __init__(self, *replies: dict) -> None:
        self.replies, self.prompts = [json.dumps(r) for r in replies], []

    async def generate(self, prompt: str, **_: object) -> str:
        self.prompts.append(prompt)
        return self.replies.pop(0)


class FakeIpa:
    engine = "fake"

    async def execute(self, _req: object) -> SimpleNamespace:
        return SimpleNamespace(engine="fake", results={"default": SimpleNamespace(full="hæz")})


REQ = WordRequest(word="has", sentence="Sam has breakfast every day of the week.", language="en", target="es")
SENTENCE = {"lemma": "have", "translation": "Sam tiene desayuno todos los días de la semana.", "examples": []}


async def test_si_traduce_la_frase_reintenta_con_la_palabra_sola():
    llm = FakeLlm(SENTENCE, {"translation": "tiene"})
    res = await LookupWordUseCase(llm, FakeIpa()).execute(REQ)
    assert res.translation == "tiene" and res.lemma == "have"
    assert "Frase:" not in llm.prompts[1]


async def test_si_insiste_no_muestra_la_frase():
    res = await LookupWordUseCase(FakeLlm(SENTENCE, SENTENCE), FakeIpa()).execute(REQ)
    assert res.translation == ""


async def test_palabra_bien_traducida_no_reintenta():
    llm = FakeLlm({"lemma": "have", "translation": "tiene", "examples": ["He has time."]})
    res = await LookupWordUseCase(llm, FakeIpa()).execute(REQ)
    assert res.translation == "tiene" and len(llm.prompts) == 1
