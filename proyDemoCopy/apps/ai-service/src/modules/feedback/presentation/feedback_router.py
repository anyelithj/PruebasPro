"""Router del modulo Feedback.

[Patron]: Controller (MVC) + Facade.
[Principio]: SRP — traduce HTTP a Use Case.
[Paradigma]: Funcional + asincrono.
"""
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends

from src.modules.feedback.application.schemas.feedback_request import (
    GenerateFeedbackRequest,
    WeaknessAnalysisRequest,
)
from src.modules.feedback.application.schemas.feedback_response import (
    FeedbackResponse,
    StudyPlanResponse,
    WeaknessAnalysisResponse,
)
from src.modules.feedback.application.use_cases.analyze_weaknesses import (
    AnalyzeWeaknessesUseCase,
)
from src.modules.feedback.application.use_cases.generate_feedback import (
    GenerateFeedbackUseCase,
)
from src.modules.feedback.application.use_cases.generate_study_plan import (
    GenerateStudyPlanUseCase,
)
from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
from src.modules.feedback.infrastructure.clients.rag_retriever import get_rag_retriever
from src.shared.dependencies.auth_deps import CurrentUserDep

router = APIRouter(prefix="/feedback", tags=["feedback"])


@lru_cache(maxsize=1)
def _get_ollama() -> OllamaClient:
    return OllamaClient()


def get_generate_feedback() -> GenerateFeedbackUseCase:
    return GenerateFeedbackUseCase(_get_ollama(), get_rag_retriever())  # Mismo índice que el tutor


def get_analyze_weaknesses() -> AnalyzeWeaknessesUseCase:
    return AnalyzeWeaknessesUseCase()


def get_study_plan() -> GenerateStudyPlanUseCase:
    return GenerateStudyPlanUseCase()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "feedback", "status": "ready"}


@router.post(
    "/generate",
    response_model=FeedbackResponse,
    summary="Feedback pedagogico inmediato (Ollama + RAG)",
)
async def generate(
    payload: GenerateFeedbackRequest,
    _user: CurrentUserDep,
    use_case: Annotated[GenerateFeedbackUseCase, Depends(get_generate_feedback)],
) -> FeedbackResponse:
    return await use_case.execute(payload)


@router.post(
    "/weaknesses",
    response_model=WeaknessAnalysisResponse,
    summary="Identifica temas debiles a partir de topic_accuracy",
)
async def weaknesses(
    payload: WeaknessAnalysisRequest,
    _user: CurrentUserDep,
    use_case: Annotated[AnalyzeWeaknessesUseCase, Depends(get_analyze_weaknesses)],
) -> WeaknessAnalysisResponse:
    return await use_case.execute(payload)


@router.post(
    "/study-plan",
    response_model=StudyPlanResponse,
    summary="Genera plan de estudio a partir de un analisis de debilidades",
)
async def study_plan(
    weakness: WeaknessAnalysisResponse,
    _user: CurrentUserDep,
    use_case: Annotated[GenerateStudyPlanUseCase, Depends(get_study_plan)],
) -> StudyPlanResponse:
    return await use_case.execute(weakness.user_id, list(weakness.weak_topics))
