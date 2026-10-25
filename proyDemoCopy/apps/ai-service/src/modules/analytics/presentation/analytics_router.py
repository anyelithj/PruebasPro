"""Router del módulo Analytics (Sprint 5.4).

[Patrón]: Controller (MVC) + Thin Controller.
[Principio]: SRP — traduce HTTP ↔ casos de uso.
[Paradigma]: Funcional + asíncrono.
[Seguridad]: solo docentes y administradores (require_role).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.modules.analytics.application.schemas.analytics_response import (
    AnomalyResponse,
    DifficultyResponse,
)
from src.modules.analytics.application.use_cases.classify_difficulty import (
    ClassifyDifficultyUseCase,
)
from src.modules.analytics.application.use_cases.detect_anomalies import (
    DetectAnomaliesUseCase,
)
from src.modules.analytics.infrastructure.repositories.analytics_repository import (
    SqlAnalyticsRepository,
)
from src.shared.dependencies.auth_deps import require_role
from src.shared.dependencies.db_deps import DbSessionDep

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_role("TEACHER", "ADMIN"))],
)

MinAttempts = Annotated[
    int, Query(ge=1, le=1000, description="Respuestas mínimas por pregunta")
]


def get_repository(session: DbSessionDep) -> SqlAnalyticsRepository:
    return SqlAnalyticsRepository(session)


Repo = Annotated[SqlAnalyticsRepository, Depends(get_repository)]


@router.get(
    "/difficulty",
    response_model=DifficultyResponse,
    summary="Dificultad real por pregunta (KMeans) frente a la declarada",
)
async def difficulty(repo: Repo, min_attempts: MinAttempts = 5) -> DifficultyResponse:
    return await ClassifyDifficultyUseCase(repo).execute(min_attempts)


@router.get(
    "/anomalies",
    response_model=AnomalyResponse,
    summary="Preguntas con respuestas atípicas (IsolationForest)",
)
async def anomalies(repo: Repo, min_attempts: MinAttempts = 5) -> AnomalyResponse:
    return await DetectAnomaliesUseCase(repo).execute(min_attempts)
