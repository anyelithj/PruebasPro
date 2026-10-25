"""Tests de GradeAnswerUseCase — orquesta Factory + Strategy (mockeados)."""
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.modules.grading.application.schemas.grading_request import (
    GradingRequest,
    QuestionType,
)
from src.modules.grading.application.use_cases.grade_answer import GradeAnswerUseCase


def _request(qtype: QuestionType = QuestionType.OPEN_ANSWER) -> GradingRequest:
    return GradingRequest(
        question_id="q1",
        question_type=qtype,
        question_text="¿pregunta?",
        correct_answer="paris",
        user_answer="paris",
    )


class TestGradeAnswer:
    @pytest.mark.asyncio
    async def test_camino_feliz(self) -> None:
        # [Mock del modelo]: grade devuelve (score, is_correct, confidence)
        model = MagicMock()
        model.name = "similarity"
        model.grade = AsyncMock(return_value=(0.9, True, 0.85))

        factory = MagicMock()
        factory.create.return_value = model

        use_case = GradeAnswerUseCase(factory=factory)
        resp = await use_case.execute(_request(), user_id="u1")

        assert resp.question_id == "q1"
        assert resp.user_id == "u1"
        assert resp.score == 0.9
        assert resp.is_correct is True
        assert resp.confidence == 0.85
        assert resp.strategy_used == "similarity"
        assert resp.feedback is None

    @pytest.mark.asyncio
    async def test_selecciona_strategy_por_tipo(self) -> None:
        # [Verifica]: el factory recibe el question_type del request
        model = MagicMock()
        model.name = "exact_match"
        model.grade = AsyncMock(return_value=(0.0, False, 1.0))
        factory = MagicMock()
        factory.create.return_value = model

        use_case = GradeAnswerUseCase(factory=factory)
        await use_case.execute(_request(QuestionType.MULTIPLE_CHOICE), user_id="u2")

        factory.create.assert_called_once_with(QuestionType.MULTIPLE_CHOICE)

    @pytest.mark.asyncio
    async def test_respuesta_incorrecta(self) -> None:
        model = MagicMock()
        model.name = "exact_match"
        model.grade = AsyncMock(return_value=(0.0, False, 1.0))
        factory = MagicMock()
        factory.create.return_value = model

        resp = await GradeAnswerUseCase(factory=factory).execute(_request(), user_id="u1")
        assert resp.is_correct is False
        assert resp.score == 0.0

    @pytest.mark.asyncio
    async def test_propaga_error_del_modelo(self) -> None:
        # [Rama de error]: si el modelo falla, el use case no lo enmascara
        model = MagicMock()
        model.name = "x"
        model.grade = AsyncMock(side_effect=RuntimeError("inference boom"))
        factory = MagicMock()
        factory.create.return_value = model

        with pytest.raises(RuntimeError, match="inference boom"):
            await GradeAnswerUseCase(factory=factory).execute(_request(), user_id="u1")
