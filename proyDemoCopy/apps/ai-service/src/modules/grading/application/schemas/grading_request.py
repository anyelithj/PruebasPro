"""Schema Pydantic v2 — request del endpoint /grading/grade.

[Patrón]: DTO + Value Object inmutable.
[Principio]: SRP + ISP.
[Paradigma]: POO + declarativo.
"""
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class QuestionType(str, Enum):
    """Tipos soportados — guía la elección de Strategy en Sprint 3.1."""

    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    OPEN_ANSWER = "open_answer"


class GradingRequest(BaseModel):
    """Petición para calificar una respuesta."""

    # [Frozen]: payload inmutable post-construcción | [Principio]: inmutabilidad
    model_config = ConfigDict(frozen=True, extra="forbid")

    question_id: str = Field(..., description="UUID de la pregunta")
    question_type: QuestionType = Field(default=QuestionType.OPEN_ANSWER)
    question_text: str = Field(..., min_length=1, max_length=2000)
    correct_answer: str = Field(..., min_length=1, max_length=2000)
    user_answer: str = Field(..., max_length=2000)
    # [Idioma objetivo ISO 639-1]: alineado con Language VO del backend (7 idiomas de la plataforma)
    language: Literal["en", "es", "fr", "de", "pt", "zh", "ru"] = "es"
    # [Tolerancia]: umbral 0..1 para considerar respuesta correcta vía similitud
    similarity_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
