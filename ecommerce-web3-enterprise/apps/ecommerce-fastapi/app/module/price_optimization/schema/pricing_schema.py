# pricing_schema.py (Pydantic v2) => contratos de optimización de precios.
# Patrón: DTO + Schema. Paradigma: declarativo + tipado estático.

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.shared.types.ml_types import JobStatus

Strategy = Literal["revenue", "clearance", "competitive"]


class RecalculateRequest(BaseModel):
    strategy: Strategy = "revenue"
    competitor_prices: list[int] = Field(default_factory=list, max_length=50)  # En centavos


class BatchRequest(BaseModel):
    product_ids: list[str] = Field(min_length=1, max_length=500)
    strategy: Strategy = "revenue"


# RF-18.10 rebajas: horizonte en semanas y peso de ingresos (1 = solo ingresos, 0 = solo utilidad)
class MarkdownRequest(BaseModel):
    weeks: int = Field(default=4, ge=1, le=8)
    revenue_weight: float = Field(default=0.5, ge=0, le=1)
    unit_cost_cents: int | None = Field(default=None, gt=0)  # Sin costo: se asume margen del 40 %
    salvage_rate: float = Field(default=0.3, ge=0, le=1)  # Valor de rescate del sobrante
    stock: int | None = Field(default=None, ge=0)  # Sin dato: se lee el inventario disponible


class MarkdownResponse(BaseModel):
    product_id: str
    price_cents: int
    stock: int
    unit_cost_cents: int
    elasticity: float
    weekly_units: float
    schedule: list[float]
    weekly_prices_cents: list[int]
    units: list[float]
    revenue_cents: int
    profit_cents: int
    leftover_units: float
    sell_through: float
    revenue_weight: float
    alternatives: list[dict[str, Any]]


class DecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    product_id: str
    current_price_cents: int
    recommended_price_cents: int
    multiplier: float
    expected_units: float
    expected_revenue_cents: int
    elasticity: float
    elasticity_method: str
    demand_model: str
    strategy: str
    explanation: dict[str, Any]
    created_at: datetime


class BatchJobResponse(BaseModel):
    job_id: str
    status: JobStatus
