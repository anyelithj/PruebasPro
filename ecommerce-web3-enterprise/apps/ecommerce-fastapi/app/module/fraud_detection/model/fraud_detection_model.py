# fraud_detection_model.py (SQLAlchemy 2.0) => entidades FraudAnalysis (análisis de una
# transacción), FraudAlert (alerta de riesgo MEDIUM/HIGH) y AlertDismissal (revisión humana, se
# conserva para auditoría PCI DSS y como etiqueta para el clasificador supervisado).
# Patrón: Active Record/Entity + Aggregate (FraudAlert -> análisis y descarte). Paradigma: POO.

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database_config import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class FraudAnalysis(Base):
    __tablename__ = "fraud_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    order_id: Mapped[str | None] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    features: Mapped[dict] = mapped_column(JSON)  # Entrada del modelo (reentrenable y auditable)
    rule_score: Mapped[float] = mapped_column(Float)
    anomaly_score: Mapped[float | None] = mapped_column(Float)  # None => sin historial suficiente
    # None => sin etiquetas suficientes
    classifier_score: Mapped[float | None] = mapped_column(Float)
    risk_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(8))  # LOW | MEDIUM | HIGH
    explanation: Mapped[dict] = mapped_column(JSON)  # Reglas disparadas + SHAP
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class FraudAlert(Base):
    __tablename__ = "fraud_alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("fraud_analyses.id", ondelete="CASCADE"), unique=True
    )
    risk_level: Mapped[str] = mapped_column(String(8), index=True)
    status: Mapped[str] = mapped_column(String(10), default="OPEN", index=True)  # OPEN | DISMISSED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    analysis: Mapped[FraudAnalysis] = relationship(lazy="selectin")
    dismissal: Mapped["AlertDismissal | None"] = relationship(
        back_populates="alert", lazy="selectin"
    )


class AlertDismissal(Base):
    __tablename__ = "alert_dismissals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # "unique" => una alerta se revisa una sola vez (la revisión es inmutable: auditoría)
    alert_id: Mapped[str] = mapped_column(
        ForeignKey("fraud_alerts.id", ondelete="CASCADE"), unique=True
    )
    reason: Mapped[str] = mapped_column(String(16))  # FALSE_POSITIVE | CONFIRMED_FRAUD | OTHER
    reviewed_by: Mapped[str] = mapped_column(String(36))  # Usuario del JWT (no el que diga el body)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    alert: Mapped[FraudAlert] = relationship(back_populates="dismissal")
