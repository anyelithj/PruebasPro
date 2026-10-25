# email_parser_model.py (SQLAlchemy 2.0) => entidades ParsedEmail (correo analizado) y
# ExtractedEntity (entidad NER encontrada en él). Relación 1-N con borrado en cascada.
# Patrón: Active Record/Entity + Aggregate (ParsedEmail es la raíz). Paradigma: POO + tipado.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database_config import Base


class ParsedEmail(Base):
    __tablename__ = "parsed_emails"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Caché: mismo correo = 1 análisis
    text_hash: Mapped[str] = mapped_column(String(64), unique=True)
    subject: Mapped[str] = mapped_column(String(255))
    sender: Mapped[str] = mapped_column(String(255))
    excerpt: Mapped[str] = mapped_column(Text)  # Primeros 500 caracteres (minimización de datos)
    intent: Mapped[str] = mapped_column(String(32))
    intent_score: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # "lazy='selectin'" => carga las entidades con UNA consulta extra (sin N+1); "cascade" => borrar
    # el correo borra sus entidades
    entities: Mapped[list["ExtractedEntity"]] = relationship(
        back_populates="email", lazy="selectin", cascade="all, delete-orphan"
    )


class ExtractedEntity(Base):
    __tablename__ = "extracted_entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email_id: Mapped[str] = mapped_column(
        ForeignKey("parsed_emails.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(32), index=True)  # ORDER_NUMBER | EMAIL | MONEY | ...
    text: Mapped[str] = mapped_column(String(255))
    start: Mapped[int] = mapped_column(Integer)
    end: Mapped[int] = mapped_column(Integer)
    email: Mapped[ParsedEmail] = relationship(back_populates="entities")
