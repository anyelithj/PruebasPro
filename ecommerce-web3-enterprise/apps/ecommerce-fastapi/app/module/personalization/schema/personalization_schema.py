# personalization_schema.py (Pydantic v2) => contratos del motor de personalización.
# Patrón: DTO + Schema. Paradigma: declarativo + tipado estático.

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.shared.types.ml_types import JobStatus


# FeedbackRequest => body de POST /feedback. "user_id" solo lo usan ADMIN/SERVICE (Express);
# un cliente siempre registra a su propio nombre (claim "sub" del JWT)
class FeedbackRequest(BaseModel):
    product_id: str = Field(max_length=36)
    event: Literal["VIEW", "WISHLIST", "CART", "PURCHASE"]
    user_id: str | None = Field(default=None, max_length=36)


class InteractionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    product_id: str
    event: str
    weight: float
    created_at: datetime


class RecommendationItem(BaseModel):
    product_id: str
    score: float
    source: Literal["hybrid", "collaborative", "content", "popular"]


class RecoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    user_id: str
    recommendations: list[RecommendationItem]
    model_version_id: str | None
    updated_at: datetime


class TrainResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    job_id: str
    model_id: str
    version: int
    status: JobStatus
