"""Router del módulo OwnLlm (Sprint 5.6 · RF-144: corrector pedagógico de redacciones).

[Patrón]: Controller (MVC) + Thin Controller.
[Principio]: SRP — traduce HTTP ↔ casos de uso.
[Paradigma]: Funcional + asíncrono.
[Seguridad]: requiere el JWT que propaga NestJS (/ai/own-llm/* es la única puerta pública).
"""
from functools import partial  # stdlib: fija argumentos del adaptador RAG
from typing import Annotated

from fastapi import APIRouter, Depends

from src.modules.own_llm.application.schemas.writing_request import (
    MAX_TEXT_LENGTH,
    SUPPORTED_LANGUAGES,
    SUPPORTED_LEVELS,
    WritingRequest,
)
from src.modules.own_llm.application.schemas.writing_response import (
    ModelCardResponse,
    ScopeResponse,
    WritingResponse,
)
from src.modules.own_llm.application.schemas.corrector_io import CorrectorInput, CorrectorResponse
from src.modules.own_llm.application.schemas.writing_request import OWN_MODEL_LANGUAGES
from src.modules.own_llm.application.use_cases.correct_sentence import CorrectSentenceUseCase
from src.modules.feedback.infrastructure.clients.rag_retriever import rag_references  # [Tarea 9]: adaptador RAG compartido
from src.modules.own_llm.application.use_cases.correct_writing import CorrectWritingUseCase
from src.modules.language_tools.presentation.language_tools_router import get_translate_use_case  # [Composition Root]: traductor de LanguageTools
from src.modules.own_llm.application.use_cases.get_model_card import GetModelCardUseCase
from src.modules.own_llm.infrastructure.models.writing_corrector_model import get_writing_corrector
from src.shared.config.settings import get_settings
from src.shared.dependencies.auth_deps import CurrentUserDep

router = APIRouter(prefix="/own-llm", tags=["own-llm"])


def get_correct_use_case() -> CorrectWritingUseCase:
    return CorrectWritingUseCase(get_writing_corrector())


def get_corrector_use_case() -> CorrectSentenceUseCase:
    """[Anexo A]: MISMO cliente y cadena que el corrector de redacciones (modelo propio → base) + traductor de LanguageTools."""
    corrector = get_writing_corrector()
    return CorrectSentenceUseCase(corrector.llm, corrector.chain, get_translate_use_case(), partial(rag_references, purpose="corrector"))


def get_model_card_use_case() -> GetModelCardUseCase:
    s = get_settings()
    return GetModelCardUseCase(get_writing_corrector().llm, s.ollama_corrector_model, s.ollama_model, s.own_llm_model_card_path)


@router.post(
    "/correct",
    response_model=WritingResponse,
    summary="Corregir una redacción (LLM propio; respaldo al modelo base)",
    responses={503: {"description": "Ningún modelo disponible"}},
)
async def correct(
    payload: WritingRequest,
    _user: CurrentUserDep,
    use_case: Annotated[CorrectWritingUseCase, Depends(get_correct_use_case)],
) -> WritingResponse:
    return await use_case.execute(payload)


@router.post(
    "/corrector",
    response_model=CorrectorResponse,
    summary="Corrector pedagógico ÚNICO (Anexo A): reglas → LLM propio → base; un JSON para feedback, puntuación y avatar",
)
async def corrector(
    payload: CorrectorInput,
    _user: CurrentUserDep,
    use_case: Annotated[CorrectSentenceUseCase, Depends(get_corrector_use_case)],
) -> CorrectorResponse:
    return await use_case.execute(payload, OWN_MODEL_LANGUAGES)  # Nunca 503: sin LLM responde con las reglas


@router.get("/scope", response_model=ScopeResponse, summary="Idiomas y niveles que corrige el modelo")
async def scope(_user: CurrentUserDep) -> ScopeResponse:
    return ScopeResponse(languages=list(SUPPORTED_LANGUAGES), levels=list(SUPPORTED_LEVELS), max_text_length=MAX_TEXT_LENGTH)


@router.get("/model", response_model=ModelCardResponse, summary="Ficha del modelo publicado y sus métricas")
async def model_card(
    _user: CurrentUserDep,
    use_case: Annotated[GetModelCardUseCase, Depends(get_model_card_use_case)],
) -> ModelCardResponse:
    return await use_case.execute()
