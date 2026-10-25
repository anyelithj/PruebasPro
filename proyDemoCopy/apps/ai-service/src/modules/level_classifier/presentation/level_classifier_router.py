"""Router del módulo LevelClassifier (nivel CEFR estimado).

[Patrón]: Controller (MVC) + Thin Controller + Composition Root (la factoría arma el caso de uso con el juez).
[Principio]: SRP — traduce HTTP ↔ caso de uso.
[Paradigma]: Funcional + asíncrono.
[Seguridad]: JWT propagado por NestJS (CurrentUserDep).
[Sprint 9.5]: RF-126 — lo llama NestJS Dialogues al subir un diálogo; el docente confirma el nivel.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
from src.modules.level_classifier.application.schemas.classify_request import ClassifyRequest
from src.modules.level_classifier.application.schemas.classify_response import ClassifyResponse
from src.modules.level_classifier.application.use_cases.classify_text import BANDS, ClassifyTextUseCase
from src.modules.level_classifier.infrastructure.clients.cefr_rubric_judge import RUBRIC, CefrRubricJudge
from src.shared.config.settings import get_settings
from src.shared.dependencies.auth_deps import CurrentUserDep

router = APIRouter(prefix="/level-classifier", tags=["level-classifier"])


def get_classify_use_case() -> ClassifyTextUseCase:
    s = get_settings()
    return ClassifyTextUseCase(CefrRubricJudge(OllamaClient(), s.ollama_model), s.level_classifier_min_confidence)


@router.post("/classify", summary="Nivel A1–C2 estimado, confianza, indicadores y explicación breve")
async def classify(
    payload: ClassifyRequest,
    _user: CurrentUserDep,
    use_case: Annotated[ClassifyTextUseCase, Depends(get_classify_use_case)],
) -> ClassifyResponse:
    return await use_case.execute(payload)


@router.get("/criteria", summary="Rúbrica y bandas de los indicadores por nivel")
async def get_criteria(_user: CurrentUserDep) -> dict[str, object]:
    return {"rubric": RUBRIC, "bands": BANDS, "min_confidence": get_settings().level_classifier_min_confidence}
