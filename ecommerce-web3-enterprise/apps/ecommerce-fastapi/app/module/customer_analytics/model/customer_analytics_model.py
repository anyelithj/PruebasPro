# customer_analytics_model.py (SQLAlchemy 2.0 + pgvector) => entidades CustomerSegment (segmento
# RFM/K-Means), LTVScore (valor de vida proyectado) y RecalculationJob (trabajo de recálculo).
# Patrón: Active Record/Entity. Paradigma: POO + tipado estático.

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base
from app.shared.types.ml_types import JobStatus
from app.shared.util.feature_store import Vector


class CustomerSegment(Base):
    __tablename__ = "customer_segments"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)  # Cliente en Express
    recency_days: Mapped[int] = mapped_column(Integer)
    frequency: Mapped[int] = mapped_column(Integer)
    monetary_cents: Mapped[int] = mapped_column(Integer)
    r_score: Mapped[int] = mapped_column(Integer)
    f_score: Mapped[int] = mapped_column(Integer)
    m_score: Mapped[int] = mapped_column(Integer)
    # champions | loyal | at_risk...
    rfm_segment: Mapped[str] = mapped_column(String(16), index=True)
    cluster: Mapped[int] = mapped_column(Integer, index=True)  # Grupo K-Means
    # RFM estandarizado en pgvector: permite buscar "clientes parecidos" con <=> (feature store)
    features: Mapped[list[float]] = mapped_column(Vector(3))
    job_id: Mapped[str] = mapped_column(String(36))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LTVScore(Base):
    __tablename__ = "ltv_scores"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    ltv_cents: Mapped[int] = mapped_column(Integer)  # Gasto esperado en "horizon_days"
    horizon_days: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(String(16))  # xgboost | heuristic
    job_id: Mapped[str] = mapped_column(String(36))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RecalculationJob(Base):
    __tablename__ = "recalculation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status", create_type=False), default=JobStatus.QUEUED
    )
    customers: Mapped[int | None] = mapped_column(Integer)
    k: Mapped[int | None] = mapped_column(Integer)
    silhouette: Mapped[float | None] = mapped_column(Float)
    ltv_method: Mapped[str | None] = mapped_column(String(16))
    ltv_metrics: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
