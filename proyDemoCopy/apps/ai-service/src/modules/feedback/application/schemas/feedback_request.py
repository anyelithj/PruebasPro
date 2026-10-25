"""Schemas request feedback.

[Patron]: DTO + Pydantic.
[Principio]: SRP + ISP.
"""
from pydantic import BaseModel, ConfigDict, Field


class GenerateFeedbackRequest(BaseModel):
    """Solicita feedback pedagogico para una respuesta incorrecta."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    question_id: str
    question_text: str = Field(..., min_length=1, max_length=2000)
    correct_answer: str = Field(..., min_length=1, max_length=2000)
    user_answer: str = Field(..., max_length=2000)
    topic: str | None = None
    language: str = "es"


class WeaknessAnalysisRequest(BaseModel):
    """Input para analizar debilidades a partir del historial."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    user_id: str
    # [Por-topic accuracy 0..1]: lo computa el backend NestJS y lo envia | [SSOT]
    topic_accuracy: dict[str, float] = Field(default_factory=dict)
    threshold: float = Field(default=0.6, ge=0.0, le=1.0)
