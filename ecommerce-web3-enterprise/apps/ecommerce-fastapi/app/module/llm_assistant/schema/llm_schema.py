# llm_schema.py (Pydantic v2) => contratos de entrada/salida (DTO) del asistente LLM.
# Patrón: DTO + Schema. Paradigma: declarativo + tipado estático.

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.module.llm_assistant.ml.knowledge_indexer import KnowledgeSource

MAX_MESSAGE_LENGTH = 2000  # Acota el prompt: menos tokens de entrada = menos cómputo por respuesta


# ChatRequest => cuerpo de POST /conversations/:id/messages
class ChatRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


# FeedbackRequest => cuerpo de PATCH /conversations/:id/messages/:id (👍 = up, 👎 = down)
class FeedbackRequest(BaseModel):
    feedback: Literal["up", "down"]


class ConversationCreated(BaseModel):
    conversation_id: str


# "from_attributes=True" => se construye directo desde la entidad SQLAlchemy (model_validate)
class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime


# ConversationPage => listado por cursor: "next_cursor" null => no hay más páginas
class ConversationPage(BaseModel):
    items: list[ConversationResponse]
    next_cursor: datetime | None


# SourceResponse => fuente RAG citada en una respuesta ([n] en el texto)
class SourceResponse(BaseModel):
    id: str
    source: str
    title: str
    score: float


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: Literal["user", "assistant"]
    content: str
    model: str | None
    latency_ms: int | None
    feedback: Literal["up", "down"] | None
    sources: list[SourceResponse] | None = None
    created_at: datetime


# ConversationDetail => conversación + historial (herencia: reutiliza los campos de la anterior)
class ConversationDetail(ConversationResponse):
    messages: list[MessageResponse]


# ToolCallResponse => auditoría de una herramienta invocada por el LLM
class ToolCallResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    conversation_id: str
    message_id: str | None
    user_id: str
    tool: str
    arguments: dict[str, Any]
    status: str
    http_status: int | None
    result: dict[str, Any] | list[Any] | None
    latency_ms: int
    created_at: datetime


# MessageDetail => respuesta + herramientas usadas para construirla (GET mensaje por ID)
class MessageDetail(MessageResponse):
    tool_calls: list[ToolCallResponse]


# KnowledgeIndexRequest => POST /knowledge/index. "product_ids" => re-indexación por evento de
# producto (Express llama con rol SERVICE al crear/editar/archivar productos)
class KnowledgeIndexRequest(BaseModel):
    sources: list[KnowledgeSource] = Field(
        default=["products", "faq", "policies"], min_length=1, max_length=3
    )
    product_ids: list[str] | None = Field(default=None, min_length=1, max_length=500)


# JobAccepted => 202 Accepted de los trabajos en segundo plano (Celery)
class JobAccepted(BaseModel):
    job_id: str
    status: str


class KnowledgeChunkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source: str
    source_id: str
    lang: str
    category: str | None
    title: str
    content: str
    created_at: datetime  # Sin "embedding": 768 floats que el cliente no necesita


class EvaluationRequest(BaseModel):
    tier: Literal["economic", "strong"] = "economic"  # Modelo a evaluar (enrutamiento 5B.5)


class EvaluationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str
    tier: str
    model: str | None
    questions: int | None
    faithfulness: float | None
    hallucination_rate: float | None
    keyword_recall: float | None
    avg_latency_ms: int | None
    p95_latency_ms: int | None
    est_tokens: int | None
    mlflow_run_id: str | None
    error: str | None
    created_at: datetime
    finished_at: datetime | None


# EvaluationDetail => métricas + resultado por pregunta (el listado no lo trae: menos bytes)
class EvaluationDetail(EvaluationResponse):
    details: list[dict[str, Any]] | None
