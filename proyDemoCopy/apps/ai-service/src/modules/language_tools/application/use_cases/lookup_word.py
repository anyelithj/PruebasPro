"""Caso de uso: una palabra dentro de su frase → lema, traducción según el contexto, IPA y hasta dos ejemplos.

[Patrón]: Use Case (Query) + Fan-Out (LLM e IPA en paralelo).
[Principio]: SRP + DIP + determinístico primero (el IPA sale de espeak-ng; el LLM solo redacta traducción y ejemplos).
[Paradigma]: Asíncrono.
"""

import asyncio

from src.modules.language_tools.application.schemas.ipa_request import IpaRequest
from src.modules.language_tools.application.schemas.word_request import WordRequest, WordResponse
from src.modules.language_tools.application.use_cases.transcribe_ipa import TranscribeIpaUseCase
from src.modules.language_tools.application.use_cases.translate_text import LANGUAGE_NAMES
from src.modules.language_tools.domain.interfaces.llm_client import LlmPort
from src.shared.clients.llm_json import generate_json

_SYSTEM = (
    "Eres un diccionario bilingüe. Devuelve SOLO JSON con: "
    '"lemma" (forma de diccionario o null), "translation" (traducción de la palabra EN ESA frase) y '
    '"examples" (lista de 2 frases muy breves en el idioma original con la palabra).'
)


class LookupWordUseCase:
    def __init__(self, llm: LlmPort, ipa: TranscribeIpaUseCase) -> None:
        self._llm = llm
        self._ipa = ipa

    async def execute(self, req: WordRequest) -> WordResponse:
        prompt = (
            f"Idioma: {LANGUAGE_NAMES[req.language]}. Traduce al {LANGUAGE_NAMES[req.target]}.\n"
            f"Palabra: {req.word}\nFrase: {req.sentence or req.word}"
        )
        data, ipa = await asyncio.gather(
            generate_json(self._llm, prompt, system=_SYSTEM, max_tokens=220),
            self._ipa.execute(IpaRequest(text=req.word, language=req.language)),
        )
        data = data or {}  # LLM caído → la ventana muestra igualmente el IPA y el sonido
        full = {k: r.full for k, r in ipa.results.items()}
        lemma = data.get("lemma")
        return WordResponse(
            word=req.word,
            lemma=str(lemma).strip() if lemma else None,
            translation=str(data.get("translation", "")).strip(),
            ipa_uk=full.get("uk"),
            ipa_us=full.get("us"),
            ipa=full.get("default"),
            examples=[str(e).strip() for e in data.get("examples", []) if str(e).strip()][:2],
            engine=ipa.engine,
        )
