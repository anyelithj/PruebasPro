"""Caso de uso: traducción + IPA (UK y US) en una sola llamada.

[Patrón]: Use Case (Facade de dos casos de uso) + Fan-Out (`asyncio.gather`).
[Principio]: SRP + DRY (reutiliza TranslateText y TranscribeIpa) + ISP (el interruptor UK/US no pide otra consulta).
[Paradigma]: Asíncrono.
"""

import asyncio

from src.modules.language_tools.application.schemas.ipa_request import IpaRequest
from src.modules.language_tools.application.schemas.lookup_response import LookupResponse
from src.modules.language_tools.application.schemas.translate_request import TranslateRequest
from src.modules.language_tools.application.use_cases.transcribe_ipa import TranscribeIpaUseCase
from src.modules.language_tools.application.use_cases.translate_text import TranslateTextUseCase


class LookupTermUseCase:
    def __init__(self, translate: TranslateTextUseCase, ipa: TranscribeIpaUseCase) -> None:
        self._translate = translate
        self._ipa = ipa

    async def execute(self, req: TranslateRequest) -> LookupResponse:
        translation, ipa = await asyncio.gather(
            self._translate.execute(req), self._ipa.execute(IpaRequest(text=req.text, language=req.source))
        )
        full = {k: r.full for k, r in ipa.results.items()}
        return LookupResponse(
            text=req.text,
            language=req.source,
            translation=translation,
            ipa_uk=full.get("uk"),
            ipa_us=full.get("us"),
            ipa=full.get("default"),
            engine=ipa.engine,
        )
