# ml_prediction_schema.py (Pydantic v2) => contratos de entrada/salida (DTO) de la API de
# predicciones. Patrón: DTO + Schema (validación declarativa en la frontera HTTP). Paradigma:
# declarativo + tipado estático.

from datetime import date, datetime  # Tipos de fecha (Pydantic los serializa como ISO 8601)
from typing import Any, Literal

# BaseModel => clase validada; Field => restricciones por campo
from pydantic import BaseModel, ConfigDict, Field

from app.module.ml_prediction.model.ml_prediction_model import ModelStatus
from app.shared.constants.ml_constants import MAX_HORIZON_DAYS


# PredictionRequest => cuerpo de POST /api/v1/ml/prediction
class PredictionRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=36)  # ID del producto en Express
    # "ge"/"le" => mayor o igual / menor o igual: rechaza horizontes fuera de rango con 400
    horizon_days: int = Field(default=14, ge=1, le=MAX_HORIZON_DAYS)
    # Strategy registrado en xgboost_trainer.TRAINERS: "demand-xgboost" | "demand-ensemble"
    model_name: str = "demand-xgboost"


# ForecastPoint => un día del pronóstico (Value Object)
class ForecastPoint(BaseModel):
    date: date
    units: float  # Unidades esperadas (real: la demanda media puede ser fraccionaria)


# PredictionResponse => salida de POST y de GET /:id
class PredictionResponse(BaseModel):
    # "from_attributes=True" => construye el DTO directamente desde la entidad SQLAlchemy (sin mapeo
    # manual)
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: str
    model_version_id: str
    product_id: str
    horizon_days: int
    forecast: list[ForecastPoint]
    variant: Literal["champion", "challenger"]  # Grupo A/B que atendió la predicción
    # SHAP del primer día: {"base_value": float, "contributions": {feature: float}}
    explanation: dict[str, Any] | None
    cold_start: bool  # True => historia tomada de productos visualmente similares
    created_at: datetime


# TrainJobResponse => 202 Accepted de POST /:id/train (contrato de la matriz: { job_id, status:
# QUEUED })
class TrainJobResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())  # Permite campos que empiezan por "model_"
    job_id: str
    status: ModelStatus
    model_version_id: str
    version: int
