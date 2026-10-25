"""Value Object FeedbackType.

[Patron]: Value Object (enum).
[Principio]: SRP.
"""
from enum import Enum


class FeedbackType(str, Enum):
    """Tipo de feedback generado."""

    IMMEDIATE = "immediate"  # tras respuesta incorrecta
    POST_QUIZ = "post_quiz"  # resumen al final
    WEAKNESS = "weakness"  # tema con < 60% acierto
    STUDY_PLAN = "study_plan"  # ruta de aprendizaje
