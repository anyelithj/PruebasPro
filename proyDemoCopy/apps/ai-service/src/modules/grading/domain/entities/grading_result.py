"""Entity GradingResult — resultado de calificar una respuesta.

[Patron]: Entity (DDD) / Value Object (no persiste por ahora).
[Principio]: SRP.
[Paradigma]: POO + dataclass frozen.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class GradingResult:
    """Resultado de calificacion. Inmutable."""

    question_id: str
    user_id: str
    score: float  # 0..1
    is_correct: bool
    confidence: float  # 0..1
    strategy_used: str
    feedback: str | None = None
