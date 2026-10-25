"""AnalyzeWeaknessesUseCase — identifica temas con accuracy < threshold.

[Patron]: Command + Pure Function.
[Principio]: SRP.
[Paradigma]: Funcional.
"""
from src.modules.feedback.application.schemas.feedback_request import (
    WeaknessAnalysisRequest,
)
from src.modules.feedback.application.schemas.feedback_response import (
    WeakTopic,
    WeaknessAnalysisResponse,
)


_RECOMMENDATIONS: dict[str, str] = {
    "low": "Revisa los conceptos basicos y practica con quizzes faciles.",
    "mid": "Buen camino — refuerza con preguntas de dificultad media.",
    "high": "Solido. Intenta desafios difíciles para consolidar.",
}


class AnalyzeWeaknessesUseCase:
    """Convierte topic_accuracy en weak/strong listas."""

    async def execute(
        self, request: WeaknessAnalysisRequest
    ) -> WeaknessAnalysisResponse:
        weak: list[WeakTopic] = []
        strong: list[str] = []
        for topic, acc in request.topic_accuracy.items():
            if acc < request.threshold:
                weak.append(
                    WeakTopic(
                        topic=topic,
                        accuracy=acc,
                        recommendation=_recommend(acc),
                    )
                )
            elif acc >= 0.8:
                strong.append(topic)
        # [Orden ascendente por accuracy]: lo mas debil primero
        weak.sort(key=lambda w: w.accuracy)
        return WeaknessAnalysisResponse(
            user_id=request.user_id,
            weak_topics=weak,
            strong_topics=strong,
        )


def _recommend(acc: float) -> str:
    if acc < 0.3:
        return _RECOMMENDATIONS["low"]
    if acc < 0.6:
        return _RECOMMENDATIONS["mid"]
    return _RECOMMENDATIONS["high"]
