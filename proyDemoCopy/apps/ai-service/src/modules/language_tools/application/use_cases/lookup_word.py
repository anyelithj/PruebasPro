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
from src.modules.language_tools.domain.translation_rules import quick_translation
from src.shared.clients.llm_json import generate_json

_SYSTEM = (
    "Eres un diccionario bilingüe. Devuelve SOLO JSON con: "
    '"lemma" (forma de diccionario EN EL IDIOMA ORIGINAL de la palabra, o null), '
    '"translation" (SOLO el significado de esa palabra según la frase, de 1 a 3 palabras; NUNCA traduzcas la frase entera). '
    # [Fix 2026-10-30]: ejemplo en el prompt → el modelo pequeño devolvía la frase traducida («Sam tiene desayuno…») y el lema en español («tener»)
    # [2026-11-06 · Diccionario lento]: sin «examples" (ninguna ficha los muestra) → ~4x menos tokens generados en CPU
    'Ejemplo — Palabra: has, Frase: Sam has a dog: {"lemma": "have", "translation": "tiene"}'
)
_MAX_TRANSLATION_WORDS = 4  # Más que esto no es una palabra sino una frase traducida | [Principio]: determinístico primero (no se confía en el LLM)


def _too_long(translation: object) -> bool:
    """¿El LLM tradujo la frase en vez de la palabra? Función pura | `split` (str): cuenta palabras."""
    return len(str(translation or "").split()) > _MAX_TRANSLATION_WORDS


class LookupWordUseCase:
    def __init__(self, llm: LlmPort, ipa: TranscribeIpaUseCase) -> None:
        self._llm = llm
        self._ipa = ipa

    async def execute(self, req: WordRequest) -> WordResponse:
        prompt = (
            f"Idioma: {LANGUAGE_NAMES[req.language]}. Traduce al {LANGUAGE_NAMES[req.target]}.\n"
            f"Palabra: {req.word}\nFrase: {req.sentence or req.word}"
        )
        # [2026-11-02 · Diccionario lento (> 60 s)]: glosario/respuestas cortas sin LLM → al instante | max_tokens 220 → 140 (ejemplos breves; en CPU cada token cuenta)
        quick = quick_translation(req.word, req.language, req.target)
        llm_call = asyncio.sleep(0, {"translation": quick}) if quick else generate_json(self._llm, prompt, system=_SYSTEM, max_tokens=48, temperature=0.1)
        data, ipa = await asyncio.gather(llm_call, self._ipa.execute(IpaRequest(text=req.word, language=req.language)))
        data = data or {}  # LLM caído → la ventana muestra igualmente el IPA y el sonido
        # [Fix 2026-10-30]: tradujo la frase → un reintento con la palabra sola (sin frase no hay nada más que traducir); si insiste, se muestra «no disponible» antes que una frase
        if _too_long(data.get("translation")):
            retry = await generate_json(self._llm, f"Idioma: {LANGUAGE_NAMES[req.language]}. Traduce al {LANGUAGE_NAMES[req.target]}.\nPalabra: {req.word}", system=_SYSTEM, max_tokens=40, temperature=0.1) or {}
            data = {**data, "translation": "" if _too_long(retry.get("translation")) else retry.get("translation", "")}
        full = {k: r.full for k, r in ipa.results.items()}
        lemma = data.get("lemma")
        return WordResponse(
            word=req.word,
            lemma=str(lemma).strip() if lemma else None,
            translation=str(data.get("translation", "")).strip(),
            ipa_uk=full.get("uk"),
            ipa_us=full.get("us"),
            ipa=full.get("default"),
            # [Fix 2026-10-30]: `isinstance`: el modelo a veces devuelve objetos ({"spanish": …}) → antes se pintaban como texto `{...}`
            examples=[e.strip() for e in data.get("examples", []) if isinstance(e, str) and e.strip()][:2],
            engine=ipa.engine,
        )
