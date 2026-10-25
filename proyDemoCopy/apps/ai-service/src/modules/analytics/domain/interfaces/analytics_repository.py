"""Puerto de lectura de estadísticas de preguntas.

[Patrón]: Port (Hexagonal) + Repository.
[Principio]: DIP + ISP (un solo método de lectura).
[Paradigma]: POO estructural (`Protocol`, sin herencia).
"""

from typing import Protocol

from src.modules.analytics.domain.entities.difficulty_label import QuestionStats


class AnalyticsRepository(Protocol):
    """Contrato: estadísticas por pregunta con al menos `min_attempts` respuestas."""

    async def question_stats(self, min_attempts: int) -> list[QuestionStats]: ...
