"""Tests de BatchGradeUseCase — fan-out concurrente sobre GradeAnswerUseCase."""
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.modules.grading.application.schemas.grading_request import (
    GradingRequest,
    QuestionType,
)
from src.modules.grading.application.schemas.grading_response import GradingResponse
from src.modules.grading.application.use_cases.batch_grade import BatchGradeUseCase


def _request(qid: str) -> GradingRequest:
    return GradingRequest(
        question_id=qid,
        question_type=QuestionType.OPEN_ANSWER,
        question_text="t",
        correct_answer="a",
        user_answer="a",
    )


def _response(qid: str) -> GradingResponse:
    return GradingResponse(
        question_id=qid,
        user_id="u1",
        score=1.0,
        is_correct=True,
        confidence=1.0,
        strategy_used="x",
    )


class TestBatchGrade:
    @pytest.mark.asyncio
    async def test_califica_todas_las_respuestas(self) -> None:
        grade_one = MagicMock()
        grade_one.execute = AsyncMock(
            side_effect=lambda r, user_id: _response(r.question_id)
        )

        use_case = BatchGradeUseCase(grade_one=grade_one)
        requests = [_request("q1"), _request("q2"), _request("q3")]
        results = await use_case.execute(requests, user_id="u1")

        assert len(results) == 3
        assert [r.question_id for r in results] == ["q1", "q2", "q3"]
        assert grade_one.execute.await_count == 3

    @pytest.mark.asyncio
    async def test_lote_vacio(self) -> None:
        grade_one = MagicMock()
        grade_one.execute = AsyncMock()

        results = await BatchGradeUseCase(grade_one=grade_one).execute([], user_id="u1")
        assert results == []
        grade_one.execute.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_pasa_user_id_a_cada_grade(self) -> None:
        grade_one = MagicMock()
        grade_one.execute = AsyncMock(side_effect=lambda r, user_id: _response(r.question_id))

        await BatchGradeUseCase(grade_one=grade_one).execute([_request("q1")], user_id="u99")
        grade_one.execute.assert_awaited_once()
        # [BatchGrade pasa user_id posicionalmente]: execute(r, user_id)
        args, kwargs = grade_one.execute.call_args
        assert args[1] == "u99" or kwargs.get("user_id") == "u99"

    @pytest.mark.asyncio
    async def test_propaga_error_de_una_respuesta(self) -> None:
        # [gather]: si una falla, la excepcion se propaga
        grade_one = MagicMock()
        grade_one.execute = AsyncMock(side_effect=ValueError("falla"))

        with pytest.raises(ValueError, match="falla"):
            await BatchGradeUseCase(grade_one=grade_one).execute([_request("q1")], user_id="u1")
