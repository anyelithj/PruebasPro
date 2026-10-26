"""Pruebas de EnrichLinesUseCase (2026-10-24): lotes de 20 líneas, presupuesto de tiempo e IPA sin depender del LLM.

[Patrón]: Test Double (Fake LLM y Fake Phonetizer) | [Principio]: pruebas deterministas, sin espeak-ng ni Ollama reales.
"""

import asyncio
import json

from src.modules.language_tools.application.schemas.lines_request import LinesRequest
from src.modules.language_tools.application.use_cases.enrich_lines import IPA_UNAVAILABLE, EnrichLinesUseCase
from src.modules.language_tools.application.use_cases.translate_text import TranslateTextUseCase
from src.modules.language_tools.domain.interfaces.speech_synthesizer import SpeechUnavailableError


class BatchLlm:
    """LLM falso: responde cada lote con «es:<frase>» (cuenta las llamadas y puede tardar)."""

    def __init__(self, delay: float = 0.0) -> None:
        self.calls = 0
        self.delay = delay

    async def generate(self, prompt: str, **_: object) -> str:
        self.calls += 1
        await asyncio.sleep(self.delay)  # `asyncio.sleep`: simula un modelo lento en CPU
        payload = prompt.split("\n", 1)[1]
        if payload.startswith("["):  # Lote: lista JSON de frases
            return json.dumps({"translations": [f"es:{x}" for x in json.loads(payload)]})
        return json.dumps({"translation": f"es:{payload}"})


class FakePhonetizer:
    engine = "fake 1.0"

    def __init__(self, broken: bool = False) -> None:
        self.broken = broken

    async def ipa(self, text: str, voice: str) -> str:
        return f"/{text}/"

    async def ipa_words(self, words: list[str], voice: str) -> list[str]:
        if self.broken:
            raise SpeechUnavailableError("espeak-ng no instalado")
        return [f"/{w}/{voice}" for w in words]


def _use_case(llm: BatchLlm, phonetizer: FakePhonetizer | None = None, budget: float = 5.0) -> EnrichLinesUseCase:
    return EnrichLinesUseCase(TranslateTextUseCase(llm, "m"), phonetizer or FakePhonetizer(), budget_s=budget)


async def test_letra_larga_se_traduce_en_lotes_de_20():
    # [Bug 2026-10-24]: con más de 40 líneas no se usaba el lote (80 llamadas al LLM → timeout en NestJS)
    llm = BatchLlm()
    lines = [f"line {i}" for i in range(45)]
    out = await _use_case(llm).execute(LinesRequest(lines=lines, language="en"))
    assert llm.calls == 3  # 20 + 20 + 5
    assert [x.translation for x in out.lines] == [f"es:line {i}" for i in range(45)]
    assert all(x.ipa and x.ipa_us for x in out.lines)


async def test_sin_espeak_devuelve_traduccion_e_ipa_vacio():
    out = await _use_case(BatchLlm(), FakePhonetizer(broken=True)).execute(LinesRequest(lines=["Hello"], language="fr"))
    assert out.engine == IPA_UNAVAILABLE
    assert out.lines[0].ipa == "" and out.lines[0].translation == "es:Hello"


async def test_llm_lento_responde_a_tiempo_con_el_ipa():
    # [Presupuesto]: el LLM tarda más que el plazo → la respuesta llega igual, con IPA y sin traducción (se reintenta luego)
    out = await _use_case(BatchLlm(delay=1.0), budget=0.05).execute(LinesRequest(lines=["Hello", "Bye"], language="en"))
    assert [x.translation for x in out.lines] == [None, None]
    assert all(x.ipa for x in out.lines)


async def test_espanol_no_llama_al_llm():
    llm = BatchLlm()
    out = await _use_case(llm).execute(LinesRequest(lines=["Hola"], language="es"))
    assert llm.calls == 0 and out.lines[0].translation is None
