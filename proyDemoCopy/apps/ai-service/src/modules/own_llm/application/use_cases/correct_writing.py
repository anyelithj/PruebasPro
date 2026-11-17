"""Caso de uso: corregir una redacción con el LLM propio (respaldo al modelo base).

[Patrón]: Use Case (Command) + Strategy inyectada (WritingCorrectorModel).
[Principio]: SRP — orquesta y mide; el modelo corrige, el router traduce HTTP.
[Paradigma]: POO + asíncrono.
"""

from time import perf_counter  # stdlib: reloj monótono para la latencia (trazabilidad)

from src.modules.own_llm.application.schemas.writing_request import WritingRequest
from src.modules.own_llm.application.schemas.writing_response import WritingResponse
from src.modules.own_llm.infrastructure.models.writing_corrector_model import WritingCorrectorModel
from src.shared.domain.language_detect import resolve_language


class CorrectWritingUseCase:
    def __init__(self, corrector: WritingCorrectorModel) -> None:
        self._corrector = corrector  # [DI por constructor]

    async def execute(self, req: WritingRequest) -> WritingResponse:
        started = perf_counter()
        language, detected = resolve_language(req.language, req.text)  # [2026-10-27]: «auto» → idioma detectado (sin LLM)
        draft, model = await self._corrector.correct(req.text.strip(), language, req.level, req.context)
        return WritingResponse(
            **draft.model_dump(),  # `**` (Python): desempaqueta los campos de la corrección
            model_used=model,
            fallback_used=model != self._corrector.chain_for(language)[0],  # Respaldo = no respondió el primero de la cadena de ESE idioma
            latency_ms=round((perf_counter() - started) * 1000),
            language=language,
            detected_language=detected,
        )
