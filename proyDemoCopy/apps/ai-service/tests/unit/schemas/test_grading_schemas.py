"""Tests de schemas Pydantic v2 del modulo grading."""
import pytest
from pydantic import ValidationError

from src.modules.grading.application.schemas.grading_request import (
    GradingRequest,
    QuestionType,
)
from src.modules.grading.application.schemas.grading_response import GradingResponse


class TestGradingRequest:
    def test_construccion_valida_con_defaults(self) -> None:
        req = GradingRequest(
            question_id="q1",
            question_text="¿Capital de Francia?",
            correct_answer="Paris",
            user_answer="Paris",
        )
        # [Defaults]: open_answer, es, 0.75
        assert req.question_type == QuestionType.OPEN_ANSWER
        assert req.language == "es"
        assert req.similarity_threshold == 0.75

    def test_es_frozen(self) -> None:
        req = GradingRequest(
            question_id="q1",
            question_text="t",
            correct_answer="a",
            user_answer="a",
        )
        with pytest.raises(ValidationError):
            req.user_answer = "otra"  # type: ignore[misc]

    def test_extra_forbid(self) -> None:
        with pytest.raises(ValidationError):
            GradingRequest(
                question_id="q1",
                question_text="t",
                correct_answer="a",
                user_answer="a",
                campo_extra="no permitido",
            )

    def test_question_text_vacio_invalido(self) -> None:
        with pytest.raises(ValidationError):
            GradingRequest(
                question_id="q1",
                question_text="",
                correct_answer="a",
                user_answer="a",
            )

    def test_user_answer_puede_ser_vacio(self) -> None:
        # [Sin min_length]: respuesta vacia es valida (alumno no respondio)
        req = GradingRequest(
            question_id="q1",
            question_text="t",
            correct_answer="a",
            user_answer="",
        )
        assert req.user_answer == ""

    @pytest.mark.parametrize("threshold", [-0.1, 1.1])
    def test_threshold_fuera_de_rango(self, threshold: float) -> None:
        with pytest.raises(ValidationError):
            GradingRequest(
                question_id="q1",
                question_text="t",
                correct_answer="a",
                user_answer="a",
                similarity_threshold=threshold,
            )

    def test_language_invalido(self) -> None:
        # [Italiano]: no es idioma de la plataforma
        with pytest.raises(ValidationError):
            GradingRequest(
                question_id="q1",
                question_text="t",
                correct_answer="a",
                user_answer="a",
                language="it",
            )

    @pytest.mark.parametrize("lang", ["en", "es", "fr", "de", "pt", "zh", "ru"])
    def test_language_soportados(self, lang: str) -> None:
        req = GradingRequest(
            question_id="q1",
            question_text="t",
            correct_answer="a",
            user_answer="a",
            language=lang,
        )
        assert req.language == lang

    def test_question_type_desde_string(self) -> None:
        req = GradingRequest(
            question_id="q1",
            question_type="multiple_choice",
            question_text="t",
            correct_answer="a",
            user_answer="a",
        )
        assert req.question_type is QuestionType.MULTIPLE_CHOICE


class TestGradingResponse:
    def test_construccion_valida(self) -> None:
        resp = GradingResponse(
            question_id="q1",
            user_id="u1",
            score=0.8,
            is_correct=True,
            confidence=0.9,
            strategy_used="similarity",
        )
        assert resp.feedback is None
        assert resp.strategy_used == "similarity"

    @pytest.mark.parametrize("score", [-0.1, 1.5])
    def test_score_fuera_de_rango(self, score: float) -> None:
        with pytest.raises(ValidationError):
            GradingResponse(
                question_id="q1",
                user_id="u1",
                score=score,
                is_correct=False,
                confidence=0.5,
                strategy_used="x",
            )

    @pytest.mark.parametrize("confidence", [-0.01, 1.01])
    def test_confidence_fuera_de_rango(self, confidence: float) -> None:
        with pytest.raises(ValidationError):
            GradingResponse(
                question_id="q1",
                user_id="u1",
                score=0.5,
                is_correct=False,
                confidence=confidence,
                strategy_used="x",
            )

    def test_es_frozen(self) -> None:
        resp = GradingResponse(
            question_id="q1",
            user_id="u1",
            score=0.5,
            is_correct=True,
            confidence=0.5,
            strategy_used="x",
        )
        with pytest.raises(ValidationError):
            resp.score = 0.1  # type: ignore[misc]
