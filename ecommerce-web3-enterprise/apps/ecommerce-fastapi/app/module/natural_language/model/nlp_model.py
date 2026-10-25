# nlp_model.py (SQLAlchemy 2.0) => entidades NlpResult (intención + entidades de un texto),
# ChatSession (historial completo de una conversación) y LlmResponse (cada respuesta del LLM, con
# fuentes y latencia para auditoría).
# Patrón: Active Record/Entity + Aggregate (ChatSession es la raíz de sus respuestas). Paradigma:
# POO.

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class NlpResult(Base):
    __tablename__ = "nlp_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    text: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(32))
    intent_score: Mapped[float] = mapped_column(Float)
    entities: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), index=True)  # Dueño (claim "sub" del JWT)
    messages: Mapped[list] = mapped_column(JSON, default=list)  # [{"role", "content", "at"}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # "onupdate" => SQLAlchemy actualiza la fecha en cada UPDATE de la fila
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LlmResponse(Base):
    __tablename__ = "llm_responses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True
    )
    prompt: Mapped[str] = mapped_column(Text)
    response: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(32))
    sources: Mapped[list] = mapped_column(JSON)  # Productos del RAG usados como contexto
    model: Mapped[str] = mapped_column(String(64))  # "template" si se respondió sin LLM
    latency_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# NluTrainingExample => RF-17.13 ejemplo etiquetado de una conversación REAL (texto + intención +
# entidades esperadas). source: "auto" (predicción muy segura), "agent" (etiquetado/corregido por
# un asesor) o "feedback". Solo los aprobados entran al clasificador y a las métricas (RF-17.12).
class NluTrainingExample(Base):
    __tablename__ = "nlu_training_examples"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    text: Mapped[str] = mapped_column(Text)
    intent: Mapped[str] = mapped_column(String(32), index=True)
    predicted_intent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    entities: Mapped[list] = mapped_column(JSON, default=list)  # [{"label", "text"}] esperadas
    source: Mapped[str] = mapped_column(String(16), default="auto")
    approved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
