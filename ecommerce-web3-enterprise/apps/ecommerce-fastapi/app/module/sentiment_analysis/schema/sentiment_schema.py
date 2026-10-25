# sentiment_schema.py (Pydantic v2) => contratos de entrada/salida (DTO) del módulo de sentimiento.
# Patrón: DTO + Schema. Paradigma: declarativo + tipado estático.

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_SENTIMENT_TEXT = 1000  # Una reseña larga cabe; acota CPU por petición


# AnalyzeRequest => cuerpo de POST /analyze
class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=2, max_length=MAX_SENTIMENT_TEXT)
    product_id: str | None = Field(default=None, max_length=36)
    review_id: str | None = Field(default=None, max_length=36)


class SentimentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    text: str
    product_id: str | None
    review_id: str | None
    label: Literal["positive", "neutral", "negative"]
    score: float
    engine: str
    created_at: datetime


# InsightsRequest / InsightsResponse => RF-15.11 lote de comentarios/publicaciones de redes sociales
class SocialText(BaseModel):
    id: str = Field(max_length=64)
    text: str = Field(min_length=1, max_length=MAX_SENTIMENT_TEXT)


class InsightsRequest(BaseModel):
    texts: list[SocialText] = Field(min_length=1, max_length=500)


class InsightItem(BaseModel):
    id: str
    label: Literal["positive", "neutral", "negative", "mixed"]
    score: float
    emotions: dict[str, float]  # RF-15.10 felicidad, frustración, sorpresa, decepción (0-1)


class NegativeCause(BaseModel):
    cause: str
    label: str
    count: int
    share: float
    examples: list[str]


class InsightsResponse(BaseModel):
    items: list[InsightItem]
    summary: dict
    negative_causes: list[NegativeCause]
    conclusion: str


# AggregateResponse => métricas de GET /aggregate (listSentimentAggregates)
class AggregateResponse(BaseModel):
    product_id: str | None
    period: str
    total: int
    counts: dict[str, int]
    share: dict[str, float]
    avg_score: float
    net_sentiment: float  # (positivos - negativos) / total, en [-1, 1]
