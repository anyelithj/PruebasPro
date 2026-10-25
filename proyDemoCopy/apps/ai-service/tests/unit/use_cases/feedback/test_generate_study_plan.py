"""Tests de GenerateStudyPlanUseCase — construye plan a partir de WeakTopic[]."""
import pytest

from src.modules.feedback.application.schemas.feedback_response import WeakTopic
from src.modules.feedback.application.use_cases.generate_study_plan import (
    GenerateStudyPlanUseCase,
)


def _weak(topic: str) -> WeakTopic:
    return WeakTopic(topic=topic, accuracy=0.2, recommendation="practica")


# [4 actividades por topic, minutos 10+5+8+10 = 33]
_ACTIVITIES = 4
_MINUTES_PER_TOPIC = 33


class TestGenerateStudyPlan:
    @pytest.mark.asyncio
    async def test_un_topic(self) -> None:
        resp = await GenerateStudyPlanUseCase().execute("u1", [_weak("math")])
        assert resp.user_id == "u1"
        assert len(resp.plan) == _ACTIVITIES
        assert resp.total_minutes == _MINUTES_PER_TOPIC
        # [Order]: secuencial desde 1
        assert [s.order for s in resp.plan] == [1, 2, 3, 4]
        assert all(s.topic == "math" for s in resp.plan)

    @pytest.mark.asyncio
    async def test_varios_topics_acumula(self) -> None:
        resp = await GenerateStudyPlanUseCase().execute(
            "u1", [_weak("math"), _weak("science")]
        )
        assert len(resp.plan) == _ACTIVITIES * 2
        assert resp.total_minutes == _MINUTES_PER_TOPIC * 2
        # [Order continuo a traves de topics]
        assert [s.order for s in resp.plan] == list(range(1, 9))

    @pytest.mark.asyncio
    async def test_sin_topics_plan_vacio(self) -> None:
        resp = await GenerateStudyPlanUseCase().execute("u1", [])
        assert resp.plan == []
        assert resp.total_minutes == 0
