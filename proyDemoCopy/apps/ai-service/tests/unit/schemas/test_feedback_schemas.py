"""Tests de schemas Pydantic del modulo feedback."""
import pytest
from pydantic import ValidationError

from src.modules.feedback.application.schemas.feedback_request import (
    GenerateFeedbackRequest,
    WeaknessAnalysisRequest,
)
from src.modules.feedback.application.schemas.feedback_response import (
    FeedbackResponse,
    StudyPlanResponse,
    StudyPlanStep,
    WeaknessAnalysisResponse,
    WeakTopic,
)
from src.modules.feedback.domain.value_objects.feedback_type import FeedbackType


class TestGenerateFeedbackRequest:
    def test_construccion_valida(self) -> None:
        req = GenerateFeedbackRequest(
            question_id="q1",
            question_text="¿2+2?",
            correct_answer="4",
            user_answer="5",
        )
        assert req.topic is None
        assert req.language == "es"

    def test_question_text_vacio_invalido(self) -> None:
        with pytest.raises(ValidationError):
            GenerateFeedbackRequest(
                question_id="q1",
                question_text="",
                correct_answer="4",
                user_answer="5",
            )

    def test_extra_forbid(self) -> None:
        with pytest.raises(ValidationError):
            GenerateFeedbackRequest(
                question_id="q1",
                question_text="t",
                correct_answer="4",
                user_answer="5",
                extra="no",
            )


class TestWeaknessAnalysisRequest:
    def test_defaults(self) -> None:
        req = WeaknessAnalysisRequest(user_id="u1")
        assert req.topic_accuracy == {}
        assert req.threshold == 0.6

    @pytest.mark.parametrize("threshold", [-0.1, 1.1])
    def test_threshold_fuera_de_rango(self, threshold: float) -> None:
        with pytest.raises(ValidationError):
            WeaknessAnalysisRequest(user_id="u1", threshold=threshold)

    def test_topic_accuracy_personalizado(self) -> None:
        req = WeaknessAnalysisRequest(user_id="u1", topic_accuracy={"math": 0.3})
        assert req.topic_accuracy["math"] == 0.3


class TestFeedbackResponse:
    def test_construccion_valida(self) -> None:
        resp = FeedbackResponse(
            question_id="q1",
            feedback_type=FeedbackType.IMMEDIATE,
            message="Revisa el concepto",
        )
        assert resp.references == []
        assert resp.suggestion is None

    def test_message_vacio_invalido(self) -> None:
        with pytest.raises(ValidationError):
            FeedbackResponse(
                question_id="q1",
                feedback_type=FeedbackType.IMMEDIATE,
                message="",
            )


class TestWeakTopicYAnalisis:
    def test_weak_topic(self) -> None:
        wt = WeakTopic(topic="math", accuracy=0.2, recommendation="practica")
        assert wt.topic == "math"

    def test_weakness_analysis_response(self) -> None:
        resp = WeaknessAnalysisResponse(
            user_id="u1",
            weak_topics=[WeakTopic(topic="m", accuracy=0.1, recommendation="r")],
            strong_topics=["science"],
        )
        assert len(resp.weak_topics) == 1
        assert resp.strong_topics == ["science"]


class TestStudyPlan:
    def test_study_plan_step(self) -> None:
        step = StudyPlanStep(order=1, topic="m", activity="lectura", estimated_minutes=10)
        assert step.estimated_minutes == 10

    def test_study_plan_response(self) -> None:
        resp = StudyPlanResponse(
            user_id="u1",
            plan=[StudyPlanStep(order=1, topic="m", activity="a", estimated_minutes=5)],
            total_minutes=5,
        )
        assert resp.total_minutes == 5
