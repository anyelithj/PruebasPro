"""GenerateRecommendationUseCase — recomendacion accionable derivada de un WeakTopic.

[Patron]: Command + Strategy.
[Principio]: SRP + OCP — agregar tiers de recomendacion sin modificar la API publica.
[Paradigma]: Funcional + POO.

[Contexto]: usado por GenerateStudyPlanUseCase para enriquecer cada paso con
una sugerencia textual personalizada. Tambien expuesto para consumo directo
desde NestJS si se quiere mostrar una tarjeta de recomendacion individual.
"""
from dataclasses import dataclass

from src.modules.feedback.application.schemas.feedback_response import WeakTopic


# [Tier ranges]: limites de accuracy que mapean a niveles de intervencion | [Patron]: Lookup
_TIER_LOW = 0.30
_TIER_MID = 0.60
_TIER_HIGH = 0.80


# [Mensajes por tier + topic generico]: SSOT centralizado para mensajes pedagogicos | [Principio]: DRY
_TIER_TEMPLATES: dict[str, str] = {
    "critical": (
        "Tu dominio de {topic} esta en {acc_pct}%. "
        "Empieza por una lectura introductoria y resuelve quizzes faciles con feedback inmediato."
    ),
    "low": (
        "Tu accuracy en {topic} es {acc_pct}%. "
        "Refuerza los conceptos basicos y practica 10 minutos diarios con preguntas de dificultad facil."
    ),
    "mid": (
        "Vas mejorando en {topic} ({acc_pct}%). "
        "Pasa a preguntas de dificultad media y revisa los errores con detenimiento."
    ),
    "high": (
        "Buen dominio de {topic} ({acc_pct}%). "
        "Acepta desafios dificiles para consolidar el aprendizaje a largo plazo."
    ),
}


@dataclass(frozen=True)
class RecommendationOutput:
    """Resultado emitido por el use case.

    [Patron]: Value Object inmutable.
    """

    topic: str
    accuracy: float
    tier: str
    message: str


class GenerateRecommendationUseCase:
    """A partir de un WeakTopic, produce una recomendacion accionable."""

    async def execute(self, weak_topic: WeakTopic) -> RecommendationOutput:
        # [Tier mapping]: SRP | [Patron]: Strategy seleccion
        tier = self._classify(weak_topic.accuracy)
        template = _TIER_TEMPLATES[tier]
        message = template.format(
            topic=weak_topic.topic,
            acc_pct=round(weak_topic.accuracy * 100),
        )
        return RecommendationOutput(
            topic=weak_topic.topic,
            accuracy=weak_topic.accuracy,
            tier=tier,
            message=message,
        )

    # [Funcion pura de clasificacion]: facil de testear aislada | [Principio]: SRP
    @staticmethod
    def _classify(accuracy: float) -> str:
        if accuracy < _TIER_LOW:
            return "critical"
        if accuracy < _TIER_MID:
            return "low"
        if accuracy < _TIER_HIGH:
            return "mid"
        return "high"
