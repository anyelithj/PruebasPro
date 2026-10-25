"""Entidades de analítica de aprendizaje (Sprint 5.4).

[Patrón]: Value Object inmutable (dataclass frozen).
[Principio]: SRP — solo datos del dominio, sin scikit-learn ni SQL.
[Paradigma]: POO declarativa.
"""

from dataclasses import dataclass
from typing import Literal

Difficulty = Literal[
    "easy", "medium", "hard"
]  # `Literal` (typing): mismos valores que el enum de NestJS


@dataclass(frozen=True)
class QuestionStats:
    """Desempeño real de una pregunta (lo que entra al modelo)."""

    question_id: str
    original: Difficulty  # Dificultad declarada por el autor
    attempts: int  # Respuestas registradas
    error_rate: float  # 0..1 (fracción de respuestas incorrectas)
    avg_time_ms: float  # Tiempo medio de respuesta


@dataclass(frozen=True)
class DifficultyLabel:
    """Dificultad calculada con datos reales frente a la declarada."""

    question_id: str
    original: Difficulty
    computed: Difficulty
    confidence: float  # 0..1 (cercanía al centro de su grupo)
    attempts: int
    error_rate: float

    @property
    def mismatch(self) -> bool:
        """True si los datos contradicen la dificultad declarada → revisar la pregunta."""
        return self.original != self.computed


@dataclass(frozen=True)
class Anomaly:
    """Pregunta con un patrón de respuesta atípico (outlier)."""

    question_id: str
    score: float  # Cuanto más bajo, más atípica (IsolationForest.decision_function)
    error_rate: float
    avg_time_ms: float
    reason: str  # Explicación legible para el docente
