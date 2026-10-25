"""Caso de uso: preguntas con respuestas atípicas (enunciado ambiguo, clave errónea, pregunta trivial…).

[Patrón]: Use Case (Query) + Port.
[Principio]: SRP + DIP.
[Paradigma]: POO + asíncrono.
"""

from src.modules.analytics.application.schemas.analytics_response import (
    AnomalyItem,
    AnomalyResponse,
)
from src.modules.analytics.domain.interfaces.analytics_repository import (
    AnalyticsRepository,
)
from src.modules.analytics.infrastructure.models.classifier import detect


class DetectAnomaliesUseCase:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    async def execute(self, min_attempts: int = 5) -> AnomalyResponse:
        stats = await self._repo.question_stats(min_attempts)
        anomalies = [
            AnomalyItem(
                question_id=a.question_id,
                score=a.score,
                error_rate=round(a.error_rate, 3),
                avg_time_ms=round(a.avg_time_ms, 1),
                reason=a.reason,
            )
            for a in detect(stats)
        ]
        return AnomalyResponse(analyzed=len(stats), anomalies=anomalies)
