# forecasting_schema.py (Pydantic v2) => contratos de entrada/salida (DTO) del pronóstico de
# demanda. Patrón: DTO + Schema (validación declarativa en la frontera HTTP).
# Paradigma: declarativo + tipado estático.

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.module.ml_prediction.model.ml_prediction_model import ModelStatus
from app.shared.constants.ml_constants import MAX_HORIZON_DAYS

# "Literal[...]" => solo esos valores; otro valor => 400 automático
Granularity = Literal["day", "week", "month"]


# ForecastRequest => cuerpo de POST /api/v1/ml/forecasting
class ForecastRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=36)
    horizon_days: int = Field(default=30, ge=1, le=MAX_HORIZON_DAYS)
    granularity: Granularity = "day"  # Agregado diario, semanal o mensual


# ForecastPoint => un período del pronóstico con su intervalo de confianza del 95 %
class ForecastPoint(BaseModel):
    date: date
    units: float
    lower: float
    upper: float


class ForecastResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # Entidad SQLAlchemy -> DTO sin mapeo manual
    id: str
    forecast_model_id: str
    product_id: str
    horizon_days: int
    granularity: Granularity
    forecast: list[ForecastPoint]
    # {"weekly_strength", "trend_per_day", "peak_weekday", "anomalies": [...]}
    seasonality: dict[str, Any]
    cold_start: bool
    created_at: datetime


# ForecastModelJobResponse => 202 Accepted de POST /model ({ job_id, status: QUEUED })
class ForecastModelJobResponse(BaseModel):
    job_id: str
    status: ModelStatus
    forecast_model_id: str
    version: int


# ---------- RF-24.14 simulación de promociones y eventos ----------
Event = Literal["NONE", "BLACK_FRIDAY", "CYBER_MONDAY", "CHRISTMAS"]


class SimulationRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=36)
    discount: float = Field(default=0.0, ge=0, le=0.9)  # 0.2 = 20 % de descuento
    event: Event = "NONE"
    start: date | None = None  # Sin fecha => inicio del evento elegido (o mañana)
    promo_days: int = Field(default=3, ge=1, le=31)
    horizon_days: int = Field(default=30, ge=7, le=90)


class SimulationResponse(BaseModel):
    product_id: str
    price_cents: int
    elasticity: float
    days: list[dict[str, Any]]
    baseline_units: float
    simulated_units: float
    incremental_units: float
    baseline_revenue_cents: int
    simulated_revenue_cents: int
    event_lift: float
    price_effect: float
    lift_source: str
