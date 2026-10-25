"""Tests de AnalyzeWeaknessesUseCase — clasificacion weak/strong por accuracy."""
import pytest

from src.modules.feedback.application.schemas.feedback_request import (
    WeaknessAnalysisRequest,
)
from src.modules.feedback.application.use_cases.analyze_weaknesses import (
    AnalyzeWeaknessesUseCase,
)


class TestAnalyzeWeaknesses:
    @pytest.mark.asyncio
    async def test_clasifica_weak_y_strong(self) -> None:
        req = WeaknessAnalysisRequest(
            user_id="u1",
            topic_accuracy={"math": 0.2, "science": 0.9, "history": 0.5},
            threshold=0.6,
        )
        resp = await AnalyzeWeaknessesUseCase().execute(req)

        weak_topics = {w.topic for w in resp.weak_topics}
        # [< threshold 0.6]: math y history son weak
        assert weak_topics == {"math", "history"}
        # [>= 0.8]: science es strong
        assert resp.strong_topics == ["science"]

    @pytest.mark.asyncio
    async def test_orden_ascendente_por_accuracy(self) -> None:
        req = WeaknessAnalysisRequest(
            user_id="u1",
            topic_accuracy={"a": 0.5, "b": 0.1, "c": 0.3},
            threshold=0.6,
        )
        resp = await AnalyzeWeaknessesUseCase().execute(req)
        accuracies = [w.accuracy for w in resp.weak_topics]
        # [Mas debil primero]: 0.1, 0.3, 0.5
        assert accuracies == sorted(accuracies)
        assert accuracies[0] == 0.1

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "acc,fragmento",
        [
            (0.1, "conceptos basicos"),  # low (< 0.3)
            (0.45, "dificultad media"),  # mid (< 0.6)
        ],
    )
    async def test_recomendacion_por_banda(self, acc: float, fragmento: str) -> None:
        req = WeaknessAnalysisRequest(
            user_id="u1", topic_accuracy={"t": acc}, threshold=0.6
        )
        resp = await AnalyzeWeaknessesUseCase().execute(req)
        assert fragmento in resp.weak_topics[0].recommendation

    @pytest.mark.asyncio
    async def test_recomendacion_high_con_threshold_alto(self) -> None:
        # [Rama high]: acc >= 0.6 pero weak porque threshold > acc
        req = WeaknessAnalysisRequest(
            user_id="u1", topic_accuracy={"t": 0.65}, threshold=0.7
        )
        resp = await AnalyzeWeaknessesUseCase().execute(req)
        assert "Solido" in resp.weak_topics[0].recommendation

    @pytest.mark.asyncio
    async def test_zona_media_ni_weak_ni_strong(self) -> None:
        # [0.6 <= acc < 0.8]: ni weak (>= threshold) ni strong (< 0.8)
        req = WeaknessAnalysisRequest(
            user_id="u1", topic_accuracy={"t": 0.7}, threshold=0.6
        )
        resp = await AnalyzeWeaknessesUseCase().execute(req)
        assert resp.weak_topics == []
        assert resp.strong_topics == []

    @pytest.mark.asyncio
    async def test_sin_topics(self) -> None:
        req = WeaknessAnalysisRequest(user_id="u1", topic_accuracy={})
        resp = await AnalyzeWeaknessesUseCase().execute(req)
        assert resp.weak_topics == []
        assert resp.strong_topics == []
        assert resp.user_id == "u1"
