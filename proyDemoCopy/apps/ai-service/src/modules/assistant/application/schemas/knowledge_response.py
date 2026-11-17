"""Schemas Pydantic v2 — respuestas de /assistant/knowledge* y /assistant/conversation/{id}.

[Patrón]: DTO (contrato de salida que FastAPI publica en Swagger vía `response_model`).
[Principio]: ISP — cada endpoint expone solo sus campos · contrato explícito (antes `dict` opaco en OpenAPI).
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel, ConfigDict, Field  # `BaseModel` (Pydantic): valida y serializa · `ConfigDict`: configuración del modelo

from src.modules.assistant.application.schemas.chat_response import ChatTurn  # [DRY]: reutiliza el turno de chat ya definido


class KnowledgeStatusOut(BaseModel):
    """GET /assistant/knowledge — tamaño de cada índice FAISS."""

    model_config = ConfigDict(frozen=True)  # `frozen=True`: inmutable → [Patrón]: Value Object
    available: bool  # ¿Cargó el modelo de embeddings?
    documents: int  # Recursos curriculares indexados (RAG del tutor)
    faq: int  # FAQ indexadas (Agente Guía)
    manual_sections: int  # Secciones del manual indexadas (Agente Guía)


class ReindexKnowledgeOut(BaseModel):
    """POST /assistant/knowledge/reindex."""

    model_config = ConfigDict(frozen=True)
    indexed: int  # Documentos que entraron al índice
    by_language: dict[str, int]  # Conteo por idioma (`dict[str, int]`: tipo genérico nativo de Python 3.9+)


class KnowledgeSyncIn(BaseModel):
    """POST /assistant/knowledge/sync — recursos del temario que cambiaron (Tarea 9). Solo ids: el texto se relee de la BD (SSOT)."""

    model_config = ConfigDict(frozen=True, extra="forbid")
    ids: list[str] = Field(..., min_length=1, max_length=500)  # Tope: una importación grande llega en lotes


class KnowledgeSyncOut(BaseModel):
    """Resultado de la sincronización incremental."""

    model_config = ConfigDict(frozen=True)
    indexed: int  # Fragmentos (re)indexados
    removed: list[str]  # Recursos que ya no están en el índice (borrados, archivados o vueltos a borrador)
    size: int  # Fragmentos totales tras el cambio


class FaqEmbedOut(BaseModel):
    """POST /assistant/knowledge/faq/embed."""

    model_config = ConfigDict(frozen=True)
    indexed: int  # FAQ indexadas


class ManualReindexOut(BaseModel):
    """POST /assistant/knowledge/manual/reindex."""

    model_config = ConfigDict(frozen=True)
    articles: int  # Artículos recibidos
    sections: int  # Secciones resultantes tras dividir por encabezados


class ConversationOut(BaseModel):
    """GET /assistant/conversation/{session_id}."""

    model_config = ConfigDict(frozen=True)
    id: str
    user_id: str
    messages: list[ChatTurn]  # `list[...]`: genérico nativo · Pydantic serializa `datetime` a ISO-8601
    created_at: str  # ISO-8601 (el router ya lo formatea con `isoformat()`)


class UserWordIn(BaseModel):
    """Palabra que el usuario marcó para aprender (RF-137) → fragmento PRIVADO del RAG del tutor (2026-11-14)."""

    model_config = ConfigDict(frozen=True, extra="forbid")
    id: str = Field(..., min_length=1, max_length=64)  # VocabularyEntry.id (estable: re-marcar reemplaza)
    language: str = Field(..., min_length=2, max_length=2)
    term: str = Field(..., min_length=1, max_length=160)
    translation: str = Field(default="", max_length=300)


class UserWordsIn(BaseModel):
    """POST /assistant/knowledge/user-words — solo palabras sueltas, nunca textos ni libros (tope pequeño)."""

    model_config = ConfigDict(frozen=True, extra="forbid")
    words: list[UserWordIn] = Field(..., min_length=1, max_length=50)


class UserWordsOut(BaseModel):
    indexed: int
