# personalization_model.py (SQLAlchemy 2.0) => entidades InteractionRecord (señal usuario-producto),
# PersonalizationModel (versión entrenada del recomendador) y PersonalizationProfile (caché de las
# recomendaciones de un usuario). Patrón: Active Record/Entity. Paradigma: POO + tipado.

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base
from app.shared.types.ml_types import JobStatus


def _uuid() -> str:
    return str(uuid.uuid4())


class InteractionRecord(Base):
    __tablename__ = "interaction_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    product_id: Mapped[str] = mapped_column(String(36), index=True)
    event: Mapped[str] = mapped_column(String(10))  # VIEW | WISHLIST | CART | PURCHASE
    weight: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PersonalizationModel(Base):
    __tablename__ = "personalization_models"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    version: Mapped[int] = mapped_column(Integer, unique=True)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status", create_type=False), default=JobStatus.QUEUED
    )
    metrics: Mapped[dict | None] = mapped_column(JSON)
    artifact_path: Mapped[str | None] = mapped_column(String(255))
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    trained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PersonalizationProfile(Base):
    __tablename__ = "personalization_profiles"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    recommendations: Mapped[list] = mapped_column(JSON)  # [{"product_id", "score", "source"}]
    model_version_id: Mapped[str | None] = mapped_column(String(36))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
