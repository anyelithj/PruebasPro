"""GenerateStudyPlanUseCase — construye plan de estudio personalizado.

[Patron]: Command + Builder.
[Principio]: SRP + OCP — agregar actividades amplia el plan sin tocar logica.
[Paradigma]: Funcional.
"""
from src.modules.feedback.application.schemas.feedback_response import (
    StudyPlanResponse,
    StudyPlanStep,
    WeakTopic,
)


_ACTIVITIES_PER_TOPIC: list[tuple[str, int]] = [
    ("Lectura introductoria del tema", 10),
    ("Quiz facil para refrescar", 5),
    ("Resumen de conceptos clave", 8),
    ("Quiz medio para consolidar", 10),
]


class GenerateStudyPlanUseCase:
    """A partir de WeakTopic[], emite un plan ordenado."""

    async def execute(
        self, user_id: str, weak_topics: list[WeakTopic]
    ) -> StudyPlanResponse:
        plan: list[StudyPlanStep] = []
        order = 0
        total_min = 0
        for wt in weak_topics:
            for activity, minutes in _ACTIVITIES_PER_TOPIC:
                order += 1
                total_min += minutes
                plan.append(
                    StudyPlanStep(
                        order=order,
                        topic=wt.topic,
                        activity=activity,
                        estimated_minutes=minutes,
                    )
                )
        return StudyPlanResponse(
            user_id=user_id,
            plan=plan,
            total_minutes=total_min,
        )
