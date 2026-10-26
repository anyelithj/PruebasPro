"""Caso de uso: transcribir a IPA por palabra y completo (UK y US en inglés).

[Patrón]: Use Case (Query) + Port (Phonetizer) + Fan-Out (variantes en paralelo).
[Principio]: SRP + DIP + determinístico (espeak-ng, nunca el LLM).
[Paradigma]: Asíncrono (`asyncio.gather`).
"""

import asyncio
import logging

from src.modules.language_tools.application.schemas.ipa_request import IpaRequest, IpaResponse, IpaResult, WordIpa
from src.modules.language_tools.domain.interfaces.phonetizer import Phonetizer, PhonetizerMissingError
from src.modules.language_tools.domain.interfaces.speech_synthesizer import SpeechUnavailableError
from src.modules.language_tools.domain.language_voices import ACCENT_VARIANT, DEFAULT_VARIANT, ipa_voices

logger = logging.getLogger(__name__)

_EDGE = ".,;:!?¡¿\"'()«»“”"  # Signos que se quitan de los bordes de cada palabra


def split_words(text: str, language: str) -> list[str]:
    """Palabras del texto. Chino: el texto entero (no separa con espacios; el navegador segmenta con Intl.Segmenter). [Paradigma]: función pura."""
    if language == "zh":
        return [text.strip()]
    return [w for w in (t.strip(_EDGE) for t in text.split()) if w]


class TranscribeIpaUseCase:
    def __init__(self, phonetizer: Phonetizer) -> None:
        self._ph = phonetizer

    async def _one(self, text: str, words: list[str], voice: str, variant: str) -> IpaResult:
        # `return_exceptions=True` (asyncio): un fallo del texto completo no cancela el de las palabras → resultado PARCIAL en vez de 503
        full, per_word = await asyncio.gather(self._ph.ipa(text, voice), self._ph.ipa_words(words, voice), return_exceptions=True)
        if isinstance(per_word, BaseException):
            raise per_word  # Sin IPA por palabra no hay nada que devolver (p. ej. espeak-ng no instalado → 503)
        if isinstance(full, PhonetizerMissingError):
            raise full
        if isinstance(full, SpeechUnavailableError):
            # [2026-10-24 · Degradación]: el texto completo falló (timeout puntual) → se compone con la IPA de cada palabra
            logger.warning("IPA del texto completo no disponible (%s); se compone por palabras", full)
            full = " ".join(i for i in per_word if i)
        elif isinstance(full, BaseException):
            raise full  # Error inesperado: es un bug, no se oculta
        return IpaResult(variant=variant, full=full, words=[WordIpa(word=w, ipa=i) for w, i in zip(words, per_word, strict=True)])

    async def execute(self, req: IpaRequest) -> IpaResponse:
        voices = ipa_voices(req.language)  # en → uk + us · resto → default
        if req.accent and req.language == "en":
            voices = {req.accent: voices[req.accent]}
        words = split_words(req.text, req.language)
        keys = list(voices)
        variants = [ACCENT_VARIANT.get(k, DEFAULT_VARIANT[req.language]) for k in keys]
        results = await asyncio.gather(
            *(self._one(req.text.strip(), words, voices[k], v) for k, v in zip(keys, variants, strict=True))
        )
        return IpaResponse(results=dict(zip(keys, results, strict=True)), engine=self._ph.engine)
