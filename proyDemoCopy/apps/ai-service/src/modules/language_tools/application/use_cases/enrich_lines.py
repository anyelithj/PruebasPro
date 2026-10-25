"""Caso de uso: traducir y transcribir a IPA cada línea (letras de canciones y diálogos).

[Patrón]: Use Case (Command) + Fan-Out acotado (Semaphore: no satura el LLM local).
[Principio]: SRP + DRY (reutiliza TranslateText y el Phonetizer) + determinístico primero (español → sin traducción).
[Paradigma]: Asíncrono.
[Sprint 9.1]: siete idiomas con su voz de espeak-ng; inglés con IPA UK y US en la misma respuesta; zh y ru marcados para revisión nativa.
"""

import asyncio
import json

from src.modules.language_tools.application.schemas.lines_request import EnrichedLine, LinesRequest, LinesResponse
from src.modules.language_tools.application.schemas.translate_request import TranslateRequest
from src.modules.language_tools.application.use_cases.translate_text import LANGUAGE_NAMES, TranslateTextUseCase
from src.modules.language_tools.domain.interfaces.phonetizer import Phonetizer
from src.modules.language_tools.domain.language_voices import ipa_voices
from src.shared.clients.llm_json import generate_json

_PARALLEL = 3  # Traducciones simultáneas (Ollama en CPU atiende pocas a la vez)
_BATCH_MAX = 40  # [2026-10-23]: hasta 40 líneas en UNA llamada al LLM (antes una por línea → lento y con huecos «—»)
_BATCH_SYSTEM = (
    "Eres un traductor profesional. Recibes una lista JSON de frases numeradas. Devuelve SOLO JSON "
    '{"translations": ["..."]} con la traducción al español de cada frase, en el mismo orden y con la misma cantidad. '
    "Traduce también las frases cortas («Great!» → «¡Genial!»)."
)
NATIVE_REVIEW = frozenset({"zh", "ru"})  # `frozenset`: idiomas cuyo IPA automático revisa siempre un docente nativo


class EnrichLinesUseCase:
    def __init__(self, translate: TranslateTextUseCase, phonetizer: Phonetizer) -> None:
        self._translate = translate
        self._ph = phonetizer

    async def execute(self, req: LinesRequest) -> LinesResponse:
        voices = ipa_voices(req.language)  # en → {"uk", "us"}; resto → {"default"}
        lines = [ln.strip() for ln in req.lines]
        # Un proceso por voz: una línea de IPA por línea de texto · `gather`: UK y US en paralelo
        per_voice = dict(zip(voices, await asyncio.gather(*(self._ph.ipa_words(lines, v) for v in voices.values())), strict=True))
        ipas = per_voice.get("uk") or per_voice["default"]
        ipas_us = per_voice.get("us") or [None] * len(lines)
        gate = asyncio.Semaphore(_PARALLEL)  # `Semaphore` (asyncio): máximo _PARALLEL traducciones a la vez

        async def translate(text: str) -> str | None:
            if req.language == "es" or not text:
                return None
            async with gate:
                return (await self._translate.execute(TranslateRequest(text=text, source=req.language))).translation or None

        # [2026-10-23 · Lote primero]: una llamada para todo el diálogo; solo las líneas que falten van una a una (respaldo) | [Patrón]: Batch + Fallback
        translations = await self._batch(lines, req.language)
        missing = [i for i, tr in enumerate(translations) if not tr and lines[i]]
        for i, tr in zip(missing, await asyncio.gather(*(translate(lines[i]) for i in missing)), strict=True):
            translations[i] = tr
        return LinesResponse(
            lines=[
                EnrichedLine(index=i, text=t, translation=tr, ipa=ip, ipa_us=us)
                for i, (t, tr, ip, us) in enumerate(zip(lines, translations, ipas, ipas_us, strict=True))
            ],
            engine=self._ph.engine,
            needs_native_review=req.language in NATIVE_REVIEW,
        )

    async def _batch(self, lines: list[str], language: str) -> list[str | None]:
        """Traduce todas las líneas en una sola petición al LLM; la que no venga (o si el conteo no cuadra) queda None."""
        out: list[str | None] = [None] * len(lines)
        if language == "es" or not any(lines) or len(lines) > _BATCH_MAX:
            return out
        llm = getattr(self._translate, "_llm", None)  # LLM compartido del caso de uso de traducción (mismo cliente Ollama)
        if llm is None:
            return out
        prompt = f"Traduce del {LANGUAGE_NAMES.get(language, language)} al español:\n{json.dumps(lines, ensure_ascii=False)}"
        data = await generate_json(llm, prompt, system=_BATCH_SYSTEM, max_tokens=60 + 40 * len(lines))
        items = (data or {}).get("translations")
        if isinstance(items, list) and len(items) == len(lines):
            out = [str(t).strip() or None if t is not None else None for t in items]
        return out
