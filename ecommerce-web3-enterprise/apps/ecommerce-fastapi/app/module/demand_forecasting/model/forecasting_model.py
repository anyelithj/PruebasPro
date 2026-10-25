# forecasting_model.py (SQLAlchemy 2.0) => entidades del módulo: ForecastModel (versión del modelo
# de pronóstico: pesos del ensamble + métricas del backtest) y ForecastResult (pronóstico de un
# producto). Patrón: Active Record/Entity (clase = tabla del esquema "ml").
# Paradigma: POO + tipado estático (Mapped[...]).

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base

# Reutiliza el ciclo de vida de ml_prediction (QUEUED -> TRAINING -> READY | FAILED): mismo ENUM
# "model_status" de PostgreSQL (DRY: un solo tipo para todas las versiones de modelos)
from app.module.ml_prediction.model.ml_prediction_model import ModelStatus


class ForecastModel(Base):
    __tablename__ = "forecast_models"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # "unique=True" => no puede haber dos "v3"
    version: Mapped[int] = mapped_column(Integer, unique=True)
    status: Mapped[ModelStatus] = mapped_column(
        Enum(ModelStatus, name="model_status"), default=ModelStatus.QUEUED
    )
    # Peso de Prophet en el ensamble (ARIMA = 1 - peso); lo fija el backtest
    prophet_weight: Mapped[float | None] = mapped_column()
    # {"rmse", "mae", "r2", "mape", "nrmse", "rmse_prophet", "rmse_arima", "prophet_weight"}
    metrics: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    trained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ForecastResult(Base):
    __tablename__ = "forecast_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # "ondelete='CASCADE'" => borrar una versión de modelo borra sus pronósticos
    forecast_model_id: Mapped[str] = mapped_column(
        ForeignKey("forecast_models.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[str] = mapped_column(String(36), index=True)  # ID del producto en Express
    horizon_days: Mapped[int] = mapped_column(Integer)
    granularity: Mapped[str] = mapped_column(String(5))  # day | week | month
    # [{"date": "2026-10-05", "units": 3.2, "lower": 1.1, "upper": 5.3}, ...]
    forecast: Mapped[list] = mapped_column(JSON)
    # Perfil de la historia: estacionalidad semanal, tendencia, día pico y anomalías
    seasonality: Mapped[dict] = mapped_column(JSON)
    # True => producto sin ventas: historia de productos visualmente similares (CLIP)
    cold_start: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
