# pricing_model.py (SQLAlchemy 2.0) => entidades PricingDecision (precio recomendado con su
# justificación) y BatchOptimizationJob (optimización por lotes en segundo plano).
# Las decisiones son RECOMENDACIONES: FastAPI no modifica precios en Express (un humano aprueba).
# Patrón: Active Record/Entity. Paradigma: POO + tipado.

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base
from app.shared.types.ml_types import JobStatus


def _uuid() -> str:
    return str(uuid.uuid4())


class PricingDecision(Base):
    __tablename__ = "pricing_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    product_id: Mapped[str] = mapped_column(String(36), index=True)
    current_price_cents: Mapped[int] = mapped_column(Integer)
    recommended_price_cents: Mapped[int] = mapped_column(Integer)
    multiplier: Mapped[float] = mapped_column(Float)
    expected_units: Mapped[float] = mapped_column(Float)  # Unidades diarias esperadas
    expected_revenue_cents: Mapped[int] = mapped_column(Integer)
    elasticity: Mapped[float] = mapped_column(Float)
    elasticity_method: Mapped[str] = mapped_column(String(24))  # prior | log_log_regression
    demand_model: Mapped[str] = mapped_column(String(16))  # xgboost | elasticity
    strategy: Mapped[str] = mapped_column(String(16))  # revenue | clearance | competitive
    explanation: Mapped[dict] = mapped_column(JSON)  # Brazos evaluados + mercado
    job_id: Mapped[str | None] = mapped_column(String(36), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BatchOptimizationJob(Base):
    __tablename__ = "batch_optimization_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status", create_type=False), default=JobStatus.QUEUED
    )
    strategy: Mapped[str] = mapped_column(String(16))
    product_ids: Mapped[list] = mapped_column(JSON)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    # Productos que no se pudieron optimizar
    failed: Mapped[list] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
