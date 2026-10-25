"""Adaptador SQL del puerto AnalyticsRepository (PostgreSQL compartido con NestJS).

[Patrón]: Adapter + Repository.
[Principio]: DIP (implementa el puerto del dominio) + SRP (solo lectura agregada).
[Paradigma]: Asíncrono (SQLAlchemy async).
[Fuente]: quiz_sessions.answers (jsonb) + questions.difficulty — solo LECTURA: el dueño de las tablas es NestJS.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.analytics.domain.entities.difficulty_label import QuestionStats

# [Consulta agregada]: una fila por pregunta | `jsonb_array_elements` (PostgreSQL) recorre las respuestas de cada sesión | parámetro `:min` (sin inyección)
_SQL = text(
    """
    SELECT q.id::text AS question_id,
           q.difficulty::text AS original,
           count(*) AS attempts,
           avg(CASE WHEN (a->>'isCorrect')::boolean THEN 0 ELSE 1 END) AS error_rate,
           coalesce(avg((a->>'timeTakenMs')::float), 0) AS avg_time_ms
    FROM quiz_sessions s
    CROSS JOIN LATERAL jsonb_array_elements(s.answers) AS a
    JOIN questions q ON q.id::text = a->>'questionId'
    GROUP BY q.id, q.difficulty
    HAVING count(*) >= :min
    """
)


class SqlAnalyticsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session  # [DI]: sesión por petición (DbSessionDep)

    async def question_stats(self, min_attempts: int) -> list[QuestionStats]:
        rows = (await self._session.execute(_SQL, {"min": min_attempts})).mappings()
        return [
            QuestionStats(
                question_id=r["question_id"],
                original=r["original"],
                attempts=int(r["attempts"]),
                error_rate=float(r["error_rate"]),
                avg_time_ms=float(r["avg_time_ms"]),
            )
            for r in rows
        ]
