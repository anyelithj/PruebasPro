# llm_repository.py (SQLAlchemy async) => acceso a datos del asistente: conversaciones, mensajes,
# fragmentos de conocimiento, auditoría de herramientas y evaluaciones.
# Patrón: Repository (hereda SqlRepository: DRY; la raíz del agregado es LlmConversation).
# Paradigma: asíncrono + POO.

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import defer

from app.config.database_config import Base, SqlRepository
from app.module.llm_assistant.model.llm_model import (
    KnowledgeChunk,
    LlmConversation,
    LlmEvaluationRun,
    LlmMessage,
    LlmToolCall,
)
from app.shared.types.common_types import PageMeta
from app.shared.util.pagination_util import PageParams, paginate


class LlmRepository(SqlRepository[LlmConversation]):
    entity = LlmConversation

    # find => cualquier entidad del módulo por clave primaria (identity map: sin consulta repetida)
    async def find[E: Base](self, entity: type[E], entity_id: str) -> E | None:
        return await self.session.get(entity, entity_id)

    async def save(self, *instances: Base) -> None:
        self.session.add_all(instances)
        await self.session.flush()  # INSERT inmediato: rellena id/created_at antes del commit

    # list_by_user => página por cursor: conversaciones con actividad anterior a "before"
    # (sin COUNT ni OFFSET: el costo no crece con el número de páginas)
    async def list_by_user(
        self, user_id: str, before: datetime | None, limit: int
    ) -> list[LlmConversation]:
        query = select(LlmConversation).where(LlmConversation.user_id == user_id)
        if before is not None:
            query = query.where(LlmConversation.updated_at < before)
        query = query.order_by(LlmConversation.updated_at.desc()).limit(limit)
        return list((await self.session.execute(query)).scalars())

    # messages => los últimos "limit" mensajes en orden cronológico (DESC + LIMIT en SQL y luego
    # "reversed" en memoria: nunca se lee la conversación completa)
    async def messages(self, conversation_id: str, limit: int) -> list[LlmMessage]:
        query = (
            select(LlmMessage)
            .where(LlmMessage.conversation_id == conversation_id)
            .order_by(LlmMessage.created_at.desc())
            .limit(limit)
        )
        return list(reversed((await self.session.execute(query)).scalars().all()))

    async def get_message(self, conversation_id: str, message_id: str) -> LlmMessage | None:
        query = select(LlmMessage).where(
            LlmMessage.id == message_id, LlmMessage.conversation_id == conversation_id
        )
        return (await self.session.execute(query)).scalar_one_or_none()

    async def add_message(self, message: LlmMessage) -> LlmMessage:
        await self.save(message)
        return message

    async def message_tool_calls(self, message_id: str) -> list[LlmToolCall]:
        query = select(LlmToolCall).where(LlmToolCall.message_id == message_id)
        return list((await self.session.execute(query.order_by(LlmToolCall.created_at))).scalars())

    async def list_tool_calls(
        self, tool: str | None, status: str | None, params: PageParams
    ) -> tuple[list[LlmToolCall], PageMeta]:
        query = select(LlmToolCall).order_by(LlmToolCall.created_at.desc())
        if tool:
            query = query.where(LlmToolCall.tool == tool)
        if status:
            query = query.where(LlmToolCall.status == status)
        return await paginate(self.session, query, params)

    async def list_chunks(
        self, source: str | None, lang: str | None, params: PageParams
    ) -> tuple[list[KnowledgeChunk], PageMeta]:
        # "defer" => no lee el embedding (768 floats por fila que el listado no muestra)
        query = (
            select(KnowledgeChunk)
            .options(defer(KnowledgeChunk.embedding))
            .order_by(KnowledgeChunk.source, KnowledgeChunk.source_id, KnowledgeChunk.id)
        )
        if source:
            query = query.where(KnowledgeChunk.source == source)
        if lang:
            query = query.where(KnowledgeChunk.lang == lang)
        return await paginate(self.session, query, params)

    async def delete_all_chunks(self) -> int:
        return (await self.session.execute(delete(KnowledgeChunk))).rowcount

    async def list_evaluations(self, params: PageParams) -> tuple[list[LlmEvaluationRun], PageMeta]:
        query = select(LlmEvaluationRun).order_by(LlmEvaluationRun.created_at.desc())
        return await paginate(self.session, query, params)
