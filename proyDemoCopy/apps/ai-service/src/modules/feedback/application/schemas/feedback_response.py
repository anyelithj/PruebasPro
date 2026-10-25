"""Schemas response feedback.

[Patron]: DTO + Pydantic.
[Principio]: SRP + ISP.
"""
from pydantic import BaseModel, ConfigDict, Field

from src.modules.feedback.domain.value_objects.feedback_type import FeedbackType


class FeedbackResponse(BaseModel):
    """Feedback inmediato sobre una respuesta."""

    model_config = ConfigDict(frozen=True)

    question_id: str
    feedback_type: FeedbackType
    message: str = Field(..., min_length=1)
    suggestion: str | None = None
    references: list[str] = Field(default_factory=list)


class WeakTopic(BaseModel):
    model_config = ConfigDict(frozen=True)
    topic: str
    accuracy: float
    recommendation: str


class WeaknessAnalysisResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    user_id: str
    weak_topics: list[WeakTopic]
    strong_topics: list[str]


class StudyPlanStep(BaseModel):
    model_config = ConfigDict(frozen=True)
    order: int
    topic: str
    activity: str
    estimated_minutes: int


class StudyPlanResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    user_id: str
    plan: list[StudyPlanStep]
    total_minutes: int
