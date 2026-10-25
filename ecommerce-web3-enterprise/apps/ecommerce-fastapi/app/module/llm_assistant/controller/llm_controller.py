# llm_controller.py (FastAPI + Strawberry) => traduce HTTP/GraphQL <-> casos de uso del asistente
# LLM, incluido el streaming SSE. Sin lógica de negocio (SRP).
# Patrón: Controller + DI (Depends) + Guard (CurrentUser exige JWT de Express; las rutas admin
# suman require_roles) + Adapter (GraphQL). Paradigma: asíncrono + declarativo.

from datetime import datetime
from typing import Annotated, Literal

import strawberry
from fastapi import Depends, Header, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON

from app.config.database_config import get_session
from app.module.llm_assistant.ml.response_streamer import sse_response
from app.module.llm_assistant.schema.llm_schema import (
    ChatRequest,
    ConversationCreated,
    ConversationDetail,
    ConversationPage,
    ConversationResponse,
    EvaluationDetail,
    EvaluationRequest,
    EvaluationResponse,
    FeedbackRequest,
    JobAccepted,
    KnowledgeChunkResponse,
    KnowledgeIndexRequest,
    MessageDetail,
    MessageResponse,
    ToolCallResponse,
)
from app.module.llm_assistant.service.llm_service import LlmService, build_llm_service
from app.shared.middleware.auth_middleware import CurrentUser
from app.shared.types.common_types import ApiResponse
from app.shared.types.ml_types import JobStatus
from app.shared.util.pagination_util import Page


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> LlmService:
    return build_llm_service(session)


Service = Annotated[LlmService, Depends(get_service)]


# _lang => "es-CO,es;q=0.9" -> "es" (filtro de idioma del RAG); otro idioma => sin filtro
def _lang(accept_language: str | None) -> str | None:
    code = (accept_language or "")[:2].lower()
    return code if code in ("es", "en") else None


# ---------- Conversaciones y mensajes (5B.4) ----------


# createLlmConversation() — POST /conversations (201)
async def create_llm_conversation(
    service: Service, user: CurrentUser
) -> ApiResponse[ConversationCreated]:
    conversation = await service.create(user)
    return ApiResponse(data=ConversationCreated(conversation_id=conversation.id))


# listLlmConversations() — GET /conversations?cursor=&limit= (paginación por cursor)
async def list_llm_conversations(
    service: Service,
    user: CurrentUser,
    cursor: Annotated[datetime | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ApiResponse[ConversationPage]:
    items, next_cursor = await service.list_page(user, cursor, limit)
    return ApiResponse(
        data=ConversationPage(
            items=[ConversationResponse.model_validate(item) for item in items],
            next_cursor=next_cursor,
        )
    )


# getLlmConversationById() — GET /conversations/:id (historial, solo propietario)
async def get_llm_conversation_by_id(
    conversation_id: str, service: Service, user: CurrentUser
) -> ApiResponse[ConversationDetail]:
    conversation = await service.get(user, conversation_id)
    messages = [MessageResponse.model_validate(m) for m in await service.messages(conversation_id)]
    return ApiResponse(
        data=ConversationDetail(
            **ConversationResponse.model_validate(conversation).model_dump(), messages=messages
        )
    )


# deleteLlmConversationById() — DELETE /conversations/:id (204, GDPR)
async def delete_llm_conversation_by_id(
    conversation_id: str, service: Service, user: CurrentUser
) -> None:
    await service.delete(user, conversation_id)


# createLlmMessage() — POST /conversations/:id/messages (text/event-stream)
async def create_llm_message(
    conversation_id: str,
    body: ChatRequest,
    service: Service,
    user: CurrentUser,
    accept_language: Annotated[str | None, Header()] = None,
) -> StreamingResponse:
    turn = await service.start_turn(user, conversation_id, body.content, _lang(accept_language))
    return sse_response(service.reply(turn))


# listLlmMessages() — GET /conversations/:id/messages (solo propietario)
async def list_llm_messages(
    conversation_id: str, service: Service, user: CurrentUser
) -> ApiResponse[list[MessageResponse]]:
    messages = await service.list_messages(user, conversation_id)
    return ApiResponse(data=[MessageResponse.model_validate(m) for m in messages])


# getLlmMessageById() — GET /conversations/:id/messages/:id (fuentes RAG + herramientas usadas)
async def get_llm_message_by_id(
    conversation_id: str, message_id: str, service: Service, user: CurrentUser
) -> ApiResponse[MessageDetail]:
    message, tool_calls = await service.get_message(user, conversation_id, message_id)
    return ApiResponse(
        data=MessageDetail(
            **MessageResponse.model_validate(message).model_dump(),
            tool_calls=[ToolCallResponse.model_validate(call) for call in tool_calls],
        )
    )


# updateLlmMessageFeedback() — PATCH /conversations/:id/messages/:id (feedback 👍/👎)
async def update_llm_message_feedback(
    conversation_id: str,
    message_id: str,
    body: FeedbackRequest,
    service: Service,
    user: CurrentUser,
) -> ApiResponse[MessageResponse]:
    message = await service.feedback(user, conversation_id, message_id, body.feedback)
    return ApiResponse(data=MessageResponse.model_validate(message))


# ---------- Conocimiento RAG (5B.2, rol ADMIN; indexar también SERVICE) ----------


# createKnowledgeIndexJob() — POST /knowledge/index (202 + { job_id, status: QUEUED })
async def create_knowledge_index_job(
    body: KnowledgeIndexRequest, service: Service
) -> ApiResponse[JobAccepted]:
    job_id = service.enqueue_index(list(body.sources), body.product_ids)
    return ApiResponse(data=JobAccepted(job_id=job_id, status=JobStatus.QUEUED))


# listKnowledgeChunks() — GET /knowledge?source=&lang=&page=&limit=
async def list_knowledge_chunks(
    service: Service,
    params: Page,
    source: Annotated[Literal["product", "faq", "policy"] | None, Query()] = None,
    lang: Annotated[Literal["es", "en"] | None, Query()] = None,
) -> ApiResponse[list[KnowledgeChunkResponse]]:
    chunks, meta = await service.list_chunks(source, lang, params)
    return ApiResponse(data=[KnowledgeChunkResponse.model_validate(c) for c in chunks], meta=meta)


# getKnowledgeChunkById() — GET /knowledge/:id
async def get_knowledge_chunk_by_id(
    chunk_id: str, service: Service
) -> ApiResponse[KnowledgeChunkResponse]:
    return ApiResponse(
        data=KnowledgeChunkResponse.model_validate(await service.get_chunk(chunk_id))
    )


# deleteKnowledgeChunkById() — DELETE /knowledge/:id (204)
async def delete_knowledge_chunk_by_id(chunk_id: str, service: Service) -> None:
    await service.delete_chunk(chunk_id)


# deleteAllKnowledgeChunks() — DELETE /knowledge (purga el índice vectorial)
async def delete_all_knowledge_chunks(service: Service) -> ApiResponse[dict[str, int]]:
    return ApiResponse(data={"deleted": await service.delete_all_chunks()})


# ---------- Auditoría de herramientas (5B.3, rol ADMIN) ----------


# listLlmToolCalls() — GET /tool-calls?tool=&status=&page=&limit=
async def list_llm_tool_calls(
    service: Service,
    params: Page,
    tool: Annotated[str | None, Query(max_length=40)] = None,
    status: Annotated[
        Literal["ok", "denied", "not_found", "rejected", "error"] | None, Query()
    ] = None,
) -> ApiResponse[list[ToolCallResponse]]:
    calls, meta = await service.list_tool_calls(tool, status, params)
    return ApiResponse(data=[ToolCallResponse.model_validate(c) for c in calls], meta=meta)


# getLlmToolCallById() — GET /tool-calls/:id
async def get_llm_tool_call_by_id(
    tool_call_id: str, service: Service
) -> ApiResponse[ToolCallResponse]:
    call = await service.get_tool_call(tool_call_id)
    return ApiResponse(data=ToolCallResponse.model_validate(call))


# ---------- Evaluaciones (5B.5, rol ADMIN) ----------


# createLlmEvaluationRun() — POST /evaluations (202 + { job_id, status: QUEUED })
async def create_llm_evaluation_run(
    service: Service, body: EvaluationRequest | None = None
) -> ApiResponse[JobAccepted]:
    run = await service.enqueue_evaluation((body or EvaluationRequest()).tier)
    return ApiResponse(data=JobAccepted(job_id=run.id, status=run.status))


# listLlmEvaluationRuns() — GET /evaluations?page=&limit=
async def list_llm_evaluation_runs(
    service: Service, params: Page
) -> ApiResponse[list[EvaluationResponse]]:
    runs, meta = await service.list_evaluations(params)
    return ApiResponse(data=[EvaluationResponse.model_validate(r) for r in runs], meta=meta)


# getLlmEvaluationRunById() — GET /evaluations/:id (métricas + resultado por pregunta)
async def get_llm_evaluation_run_by_id(
    run_id: str, service: Service
) -> ApiResponse[EvaluationDetail]:
    return ApiResponse(data=EvaluationDetail.model_validate(await service.get_evaluation(run_id)))


# deleteLlmEvaluationRunById() — DELETE /evaluations/:id (204)
async def delete_llm_evaluation_run_by_id(run_id: str, service: Service) -> None:
    await service.delete_evaluation(run_id)


# --- GraphQL (lectura por ID para el panel admin; mismo guard ADMIN que /graphql) ---
@strawberry.type
class KnowledgeChunkType:
    id: str
    source: str
    lang: str
    title: str
    content: str


@strawberry.type
class LlmToolCallType:
    id: str
    tool: str
    status: str
    arguments: JSON
    result: JSON | None


@strawberry.type
class LlmQuery:
    @strawberry.field
    async def knowledge_chunk(self, info: strawberry.Info, id: str) -> KnowledgeChunkType:
        chunk = await build_llm_service(info.context["session"]).get_chunk(id)
        return KnowledgeChunkType(
            id=chunk.id,
            source=chunk.source,
            lang=chunk.lang,
            title=chunk.title,
            content=chunk.content,
        )

    @strawberry.field
    async def llm_tool_call(self, info: strawberry.Info, id: str) -> LlmToolCallType:
        call = await build_llm_service(info.context["session"]).get_tool_call(id)
        return LlmToolCallType(
            id=call.id,
            tool=call.tool,
            status=call.status,
            arguments=call.arguments,
            result=call.result,
        )
