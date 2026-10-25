"""Schema Pydantic v2 — response del endpoint /grading/grade.

[Patrón]: DTO + Value Object inmutable.
[Principio]: SRP + ISP.
[Paradigma]: POO + declarativo.
"""
from pydantic import BaseModel, ConfigDict, Field


class GradingResponse(BaseModel):
    """Resultado de calificar una respuesta."""

    model_config = ConfigDict(frozen=True)

    question_id: str = Field(..., description="UUID de la pregunta")
    user_id: str = Field(..., description="UUID del usuario que respondió")
    # [Score normalizado]: 0..1 (multiplicar por máximo de la pregunta aguas arriba)
    score: float = Field(..., ge=0.0, le=1.0)
    is_correct: bool
    # [Confianza del modelo]: 0..1 — útil para decidir revisión humana en abiertas
    confidence: float = Field(..., ge=0.0, le=1.0)
    # [Feedback inmediato]: opcional, generado por Strategy de feedback en Sprint 3.2
    feedback: str | None = None
    # [Trazabilidad]: qué Strategy se usó (auditoría + análisis)
    strategy_used: str = Field(..., description="Nombre de la Strategy aplicada")
