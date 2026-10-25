"""BatchGradeUseCase — califica un lote de respuestas en paralelo.

[Patron]: Command + Fan-Out.
[Principio]: SRP.
[Paradigma]: asyncio.gather para concurrencia I/O bound.
"""
import asyncio

from src.modules.grading.application.schemas.grading_request import GradingRequest
from src.modules.grading.application.schemas.grading_response import GradingResponse
from src.modules.grading.application.use_cases.grade_answer import GradeAnswerUseCase


class BatchGradeUseCase:
    """Califica N respuestas concurrentemente."""

    def __init__(self, grade_one: GradeAnswerUseCase) -> None:
        self._grade_one = grade_one

    async def execute(
        self,
        requests: list[GradingRequest],
        user_id: str,
    ) -> list[GradingResponse]:
        # [Concurrencia I/O]: gather lanza todas las calificaciones a la vez
        tasks = [self._grade_one.execute(r, user_id) for r in requests]
        return await asyncio.gather(*tasks)
