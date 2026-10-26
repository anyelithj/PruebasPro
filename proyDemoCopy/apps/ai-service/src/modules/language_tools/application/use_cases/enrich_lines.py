"""Caso de uso: traducir y transcribir a IPA cada línea (letras de canciones y diálogos).

[Patrón]: Use Case (Command) + Fan-Out acotado (Semaphore: no satura el LLM local) + Batch + Fallback + Deadline (presupuesto de tiempo).
[Principio]: SRP + DRY (reutiliza TranslateText y el Phonetizer) + determinístico primero (español → sin traducción) + degradación elegante.
[Paradigma]: Asíncrono.
[Sprint 9.1]: siete idiomas con su voz de espeak-ng; inglés con IPA UK y US en la misma respuesta; zh y ru marcados para revisión nativa.
[2026-10-24 · Bug «el servicio de IPA y traducción no respondió»]: con más de 40 líneas se saltaba el lote y se traducía verso a verso
(80 llamadas al LLM en CPU → más de 90 s → NestJS cortaba por timeout y se perdía TAMBIÉN el IPA). Ahora: lotes de 20 líneas, un
presupuesto de tiempo para la traducción (lo que no llegue queda en None y se reintenta después) y el IPA nunca depende del LLM.
[2026-10-25 · Bug JSON crudo como traducción]: cada elemento del lote se limpia y valida con TranslateText.accept (JSON anidado,
comas colgantes, «yes» sin traducir, glosario); lo dudoso va al respaldo una a una (con reintento) o queda en None, nunca basura.
"""

import asyncio
import json
import logging

from src.modules.language_tools.application.schemas.lines_request import EnrichedLine, LinesRequest, LinesResponse
from src.modules.language_tools.application.use_cases.translate_text import (
    LANGUAGE_NAMES,
    TRANSLATION_RULES,
    TranslateTextUseCase,
    system_with_glossary,
)
from src.modules.language_tools.domain.interfaces.phonetizer import Phonetizer
from src.modules.language_tools.domain.interfaces.speech_synthesizer import SpeechUnavailableError
from src.modules.language_tools.domain.language_voices import ipa_voices
from src.shared.clients.llm_json import generate_json
from src.shared.domain.text_norm import norm

logger = logging.getLogger("ai-service.enrich-lines")  # `logging.getLogger` (stdlib): logger con nombre → filtrable en los logs

_PARALLEL = 3  # Traducciones simultáneas (Ollama en CPU atiende pocas a la vez)
_BATCH_MAX = 20  # [2026-10-24]: líneas por llamada al LLM (antes 40 y, si había más, NINGÚN lote) → respuestas cortas que el modelo 8B termina a tiempo
# [Presupuesto · 2026-10-24]: segundos máximos de traducción por petición; NestJS espera 90 s → siempre responde antes con el IPA y lo traducido
TRANSLATION_BUDGET_S = 70.0
# [2026-10-25]: mismas reglas que la traducción suelta (tú, glosario, frases cortas) + ejemplo de formato → sin JSON anidado en la salida
_BATCH_SYSTEM = (
    f"Eres un traductor profesional. {TRANSLATION_RULES}\n"
    "Recibes una lista JSON de frases. Devuelve SOLO JSON "
    '{"translations": ["..."]} con la traducción al español de cada frase como TEXTO plano, en el mismo orden y con la misma cantidad.\n'
    'Ejemplo: ["Yes", "Do you prefer tacos?"] → {"translations": ["Sí", "¿Prefieres tacos?"]}'
)
NATIVE_REVIEW = frozenset({"zh", "ru"})  # `frozenset`: idiomas cuyo IPA automático revisa siempre un docente nativo
IPA_UNAVAILABLE = "unavailable"  # Motor informado cuando espeak-ng falta o falla (las líneas llegan con IPA vacío y traducción)


class EnrichLinesUseCase:
    def __init__(
        self, translate: TranslateTextUseCase, phonetizer: Phonetizer, budget_s: float = TRANSLATION_BUDGET_S
    ) -> None:
        self._translate = translate
        self._ph = phonetizer
        self._budget_s = budget_s  # [DI]: los tests inyectan un presupuesto corto

    async def execute(self, req: LinesRequest) -> LinesResponse:
        lines = [ln.strip() for ln in req.lines]
        # `gather` (asyncio): IPA (determinista, rápido) y traducción (LLM, lento) en paralelo → la traducción no retrasa el IPA
        (ipas, ipas_us, engine), translations = await asyncio.gather(
            self._ipa(lines, req.language), self._translations(lines, req.language)
        )
        return LinesResponse(
            lines=[
                EnrichedLine(index=i, text=t, translation=tr, ipa=ip, ipa_us=us)
                for i, (t, tr, ip, us) in enumerate(zip(lines, translations, ipas, ipas_us, strict=True))
            ],
            engine=engine,
            needs_native_review=req.language in NATIVE_REVIEW,
        )

    async def _ipa(self, lines: list[str], language: str) -> tuple[list[str], list[str | None], str]:
        """IPA por voz (UK y US en inglés); si espeak-ng falta o falla → IPA vacío (la traducción sigue) | [Patrón]: Null Object."""
        voices = ipa_voices(language)  # en → {"uk", "us"}; resto → {"default"}
        try:
            # Un proceso por voz: una línea de IPA por línea de texto · `gather`: UK y US en paralelo · `strict=True`: mismo número de voces y resultados
            per_voice = dict(zip(voices, await asyncio.gather(*(self._ph.ipa_words(lines, v) for v in voices.values())), strict=True))
        except SpeechUnavailableError as exc:  # `except ... as` (Python): solo el fallo conocido del fonetizador; otro error sí es un bug
            logger.warning("IPA no disponible, se devuelven las líneas sin IPA: %s", exc)
            return [""] * len(lines), [None] * len(lines), IPA_UNAVAILABLE
        ipas = per_voice.get("uk") or per_voice["default"]
        ipas_us: list[str | None] = list(per_voice.get("us") or [None] * len(lines))
        return ipas, ipas_us, self._ph.engine

    async def _translations(self, lines: list[str], language: str) -> list[str | None]:
        """Lotes primero; las líneas que falten van una a una — todo dentro del presupuesto | [Patrón]: Batch + Fallback + Deadline."""
        out: list[str | None] = [None] * len(lines)  # Se rellena EN SITIO → si vence el plazo, lo ya traducido se conserva
        if language == "es" or not any(lines):
            return out  # [Determinístico]: el contenido ya está en español
        try:
            # `asyncio.wait_for` (asyncio): cancela la traducción al vencer el presupuesto y devuelve lo que haya
            await asyncio.wait_for(self._fill(out, lines, language), timeout=self._budget_s)
        except TimeoutError:  # Python 3.11+: asyncio.TimeoutError es el TimeoutError nativo
            logger.warning("Traducción cortada a los %.0f s: %d de %d líneas", self._budget_s, sum(t is not None for t in out), len(lines))
        return out

    async def _fill(self, out: list[str | None], lines: list[str], language: str) -> None:
        # [Determinístico primero · 2026-10-25]: respuestas cortas («yes»), glosario y caché → sin LLM
        for i, line in enumerate(lines):
            out[i] = self._translate.known(line, language) if line else None
        pending = [i for i, tr in enumerate(out) if tr is None and lines[i]]  # Índices que aún necesitan el LLM
        # [Lote]: trozos de _BATCH_MAX líneas en secuencia (Ollama en CPU atiende una inferencia larga a la vez)
        for start in range(0, len(pending), _BATCH_MAX):
            chunk = pending[start : start + _BATCH_MAX]  # Slicing (Python): sublista de índices
            for i, tr in zip(chunk, await self._batch([lines[i] for i in chunk], language), strict=True):
                out[i] = tr
        # [Respaldo]: las líneas que el lote no tradujo (o tradujo mal) van una a una — con su reintento — de _PARALLEL en _PARALLEL
        gate = asyncio.Semaphore(_PARALLEL)  # `Semaphore` (asyncio): máximo _PARALLEL traducciones a la vez

        async def one(i: int) -> None:
            async with gate:  # `async with` (Python): adquiere y libera el semáforo aunque haya excepción
                out[i] = await self._translate.translate_line(lines[i], language)

        await asyncio.gather(*(one(i) for i, tr in enumerate(out) if tr is None and lines[i]))

    async def _batch(self, lines: list[str], language: str) -> list[str | None]:
        """Traduce un trozo en una sola petición; cada elemento se limpia y valida (JSON anidado, inglés, glosario) → None si no sirve."""
        out: list[str | None] = [None] * len(lines)
        if not any(lines):
            return out
        prompt = f"Traduce del {LANGUAGE_NAMES.get(language, language)} al español:\n{json.dumps(lines, ensure_ascii=False)}"
        system = system_with_glossary(_BATCH_SYSTEM, lines, language)
        data = await generate_json(self._translate.llm, prompt, system=system, max_tokens=60 + 40 * len(lines), temperature=0.1)
        items = _batch_items(data, lines)
        if items is not None:
            out = [self._translate.accept(line, raw, language) for line, raw in zip(lines, items, strict=True)]
        return out


def _batch_items(data: dict[str, object] | None, lines: list[str]) -> list[object] | None:
    """Elementos alineados con las líneas: `{"translations": [...]}` o, si el modelo devolvió `{"<frase>": "<traducción>"}`, por clave.

    None si el conteo no cuadra (mejor traducir una a una que desalinear). [Patrón]: Tolerant Reader.
    """
    if not data:
        return None
    items = data.get("translations")
    if isinstance(items, list) and len(items) == len(lines):
        return items
    by_key = {norm(str(k)): v for k, v in data.items()}  # Comprensión de dict: claves normalizadas («Yes» == «yes»)
    hits = [by_key.get(norm(line)) for line in lines]
    return hits if any(h is not None for h in hits) else None
