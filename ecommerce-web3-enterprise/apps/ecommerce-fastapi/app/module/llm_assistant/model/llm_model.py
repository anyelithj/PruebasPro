# llm_model.py (SQLAlchemy 2.0 + pgvector) => entidades del asistente LLM: LlmConversation
# (conversación de un usuario), LlmMessage (cada turno, con modelo, latencia, fuentes RAG y feedback
# 👍/👎), KnowledgeChunk (fragmento de conocimiento con embedding, 5B.2), LlmToolCall (auditoría de
# herramientas, 5B.3) y LlmEvaluationRun (corrida de evaluación, 5B.5).
# Patrón: Entity + Aggregate (la conversación es la raíz de sus mensajes). Paradigma: POO.

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base
from app.shared.constants.ml_constants import TEXT_EMBEDDING_DIM
from app.shared.types.ml_types import JobStatus
from app.shared.util.feature_store import Vector


def _uuid() -> str:
    return str(uuid.uuid4())


class LlmConversation(Base):
    __tablename__ = "llm_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), index=True)  # Dueño (claim "sub" del JWT)
    title: Mapped[str | None] = mapped_column(String(80))  # Inicio del primer mensaje
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Índice: el listado se ordena por actividad reciente (paginación por cursor)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True
    )


class LlmMessage(Base):
    __tablename__ = "llm_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # "ondelete=CASCADE" => borrar la conversación borra sus mensajes en la BD (GDPR, 1 sentencia)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("llm_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(10))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(String(64))  # Solo respuestas del asistente
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    feedback: Mapped[str | None] = mapped_column(String(4))  # up | down (PATCH del usuario)
    # Fuentes RAG citadas: [{"id", "title", "source", "score"}] (sin el texto: ya está en el índice)
    sources: Mapped[list | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    # HNSW + coseno (pgvector): búsqueda aproximada en milisegundos sin recorrer la tabla
    __table_args__ = (
        Index(
            "ix_knowledge_chunks_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_knowledge_chunks_source", "source", "source_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    source: Mapped[str] = mapped_column(String(16))  # product | faq | policy
    source_id: Mapped[str] = mapped_column(String(64))  # ID del producto o clave de la FAQ
    lang: Mapped[str] = mapped_column(String(2), index=True)  # es | en (filtro por metadatos)
    category: Mapped[str | None] = mapped_column(String(80))  # Categoría del producto o tema
    title: Mapped[str] = mapped_column(String(160))
    content: Mapped[str] = mapped_column(Text)
    # Huella SHA-256 del texto: re-indexar solo calcula embeddings de lo que cambió (ahorro de CPU)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(TEXT_EMBEDDING_DIM))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LlmToolCall(Base):
    __tablename__ = "llm_tool_calls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # Sin FK a la conversación: la auditoría sobrevive al borrado GDPR del chat (no guarda texto
    # del usuario, solo argumentos validados y un resumen del resultado)
    conversation_id: Mapped[str] = mapped_column(String(36), index=True)
    message_id: Mapped[str | None] = mapped_column(String(36), index=True)  # Respuesta asociada
    user_id: Mapped[str] = mapped_column(String(36), index=True)  # JWT con el que se ejecutó
    tool: Mapped[str] = mapped_column(String(40), index=True)
    arguments: Mapped[dict] = mapped_column(JSON)
    # ok | denied (Express 401/403) | not_found | rejected (argumentos inválidos) | error
    status: Mapped[str] = mapped_column(String(10), index=True)
    http_status: Mapped[int | None] = mapped_column(Integer)
    result: Mapped[dict | list | None] = mapped_column(JSON)  # Resumen que vio el LLM
    latency_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class LlmEvaluationRun(Base):
    __tablename__ = "llm_evaluation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status", create_type=False), default=JobStatus.QUEUED
    )
    tier: Mapped[str] = mapped_column(String(8))  # economic | strong (enrutamiento evaluado)
    model: Mapped[str | None] = mapped_column(String(64))
    questions: Mapped[int | None] = mapped_column(Integer)
    faithfulness: Mapped[float | None] = mapped_column(Float)  # 0–1: respuesta apoyada en contexto
    hallucination_rate: Mapped[float | None] = mapped_column(Float)  # % respuestas no apoyadas
    keyword_recall: Mapped[float | None] = mapped_column(Float)  # 0–1: datos esperados presentes
    avg_latency_ms: Mapped[int | None] = mapped_column(Integer)
    p95_latency_ms: Mapped[int | None] = mapped_column(Integer)
    est_tokens: Mapped[int | None] = mapped_column(Integer)  # Costo: tokens estimados (0 USD local)
    details: Mapped[list | None] = mapped_column(JSON)  # Resultado por pregunta
    mlflow_run_id: Mapped[str | None] = mapped_column(String(64))
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
