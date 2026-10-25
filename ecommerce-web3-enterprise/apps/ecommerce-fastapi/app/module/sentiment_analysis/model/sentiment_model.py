# sentiment_model.py (SQLAlchemy 2.0) => entidad SentimentResult (resultado de sentimiento).
# SentimentAggregate no se guarda: se calcula al pedirla (sin datos duplicados que mantener).
# Patrón: Active Record/Entity. Paradigma: POO + tipado estático.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base


class SentimentResult(Base):
    __tablename__ = "sentiment_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Huella SHA-256 del texto: "unique" => el mismo texto nunca se analiza dos veces (caché en BD)
    text_hash: Mapped[str] = mapped_column(String(64), unique=True)
    text: Mapped[str] = mapped_column(Text)  # Recortado a 1000 caracteres (MAX_SENTIMENT_TEXT)
    product_id: Mapped[str | None] = mapped_column(String(36), index=True)
    review_id: Mapped[str | None] = mapped_column(String(36))
    label: Mapped[str] = mapped_column(String(10))  # positive | neutral | negative
    score: Mapped[float] = mapped_column(Float)  # Confianza 0-1 de la etiqueta
    engine: Mapped[str] = mapped_column(String(64))  # Codificador usado (trazabilidad)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
