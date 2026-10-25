# nlp_schema.py (Pydantic v2) => contratos del módulo de lenguaje natural.
# Patrón: DTO + Schema. Paradigma: declarativo + tipado estático.

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class IntentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    # RF-17.13 id de la conversación real (Express): el mensaje se guarda para entrenar
    conversation_id: str | None = Field(default=None, max_length=64)


class NlpResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    text: str
    intent: str
    intent_score: float
    entities: list[dict[str, Any]]
    created_at: datetime
    # RF-17.9 consulta corregida, correcciones {mal: bien} y sinónimos; RF-17.10 baja confianza
    normalized_text: str = ""
    corrections: dict[str, str] = {}
    expansions: list[str] = []
    low_confidence: bool = False


class MessageRequest(BaseModel):
    session_id: str | None = Field(default=None, max_length=36)  # None => nueva conversación
    message: str = Field(min_length=1, max_length=1000)


class LlmResponseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: str
    session_id: str
    response: str
    intent: str
    sources: list[dict[str, Any]]
    model: str
    latency_ms: int
    created_at: datetime


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    messages: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


# ---------- RF-17.13 entrenamiento continuo / RF-17.12 métricas ----------
class EntityLabel(BaseModel):
    label: str = Field(min_length=2, max_length=24)
    text: str = Field(min_length=1, max_length=200)


class TrainingExampleIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    intent: str = Field(pattern=r"^[a-z_]{2,32}$")
    entities: list[EntityLabel] = []


class TrainingExamplePatch(BaseModel):
    intent: str | None = Field(default=None, pattern=r"^[a-z_]{2,32}$")
    entities: list[EntityLabel] | None = None
    approved: bool | None = None


class TrainingExampleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    text: str
    intent: str
    predicted_intent: str | None
    confidence: float | None
    entities: list[dict[str, Any]]
    source: str
    approved: bool
    conversation_id: str | None
    created_at: datetime
