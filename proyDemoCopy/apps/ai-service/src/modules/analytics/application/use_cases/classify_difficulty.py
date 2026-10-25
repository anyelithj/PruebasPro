"""Caso de uso: dificultad real de cada pregunta según cómo responden los estudiantes.

[Patrón]: Use Case (Query) + Port.
[Principio]: SRP + DIP — no conoce SQL ni scikit-learn concretos.
[Paradigma]: POO + asíncrono.
"""

from src.modules.analytics.application.schemas.analytics_response import (
    DifficultyItem,
    DifficultyResponse,
)
from src.modules.analytics.domain.interfaces.analytics_repository import (
    AnalyticsRepository,
)
from src.modules.analytics.infrastructure.models.classifier import (
    MIN_FOR_MODEL,
    classify,
)


class ClassifyDifficultyUseCase:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    async def execute(self, min_attempts: int = 5) -> DifficultyResponse:
        stats = await self._repo.question_stats(min_attempts)
        labels = classify(stats)
        items = [
            DifficultyItem(
                question_id=lb.question_id,
                original=lb.original,
                new_label=lb.computed,
                confidence=lb.confidence,
                attempts=lb.attempts,
                error_rate=round(lb.error_rate, 3),
                mismatch=lb.mismatch,
            )
            for lb in labels
        ]
        return DifficultyResponse(
            method="kmeans" if len(stats) >= MIN_FOR_MODEL else "threshold",
            questions=items,
            mismatches=sum(1 for i in items if i.mismatch),
        )
