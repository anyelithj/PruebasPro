# llm_service.py (Ollama + pgvector + httpx + Redis + SQLAlchemy + Celery + MLflow) => casos de uso
# del asistente: conversaciones, respuesta en streaming con RAG + tool use + guardrails, feedback
# 👍/👎, índice de conocimiento, auditoría de herramientas y evaluaciones.
# Patrón: Service Layer + Strategy (proveedor LLM y recuperador inyectados: DIP) + Observer (tokens
# emitidos por SSE) + Unit of Work (el service decide cuándo hacer commit) + Producer (encola
# indexación y evaluación en Celery) + Factory (build_llm_service).
# Paradigma: POO + asíncrono.
# Ahorro de recursos: memoria multi-turn en Redis con ventana corta (natural_language/
# context_manager, DRY), contexto RAG de pocos fragmentos, una sola ronda de herramientas por
# respuesta y trabajos pesados (embeddings del catálogo, evaluaciones) fuera del proceso web.

import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import partial
from typing import Any, Protocol

import mlflow
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.celery_config import celery_app
from app.config.llm_config import get_llm_settings
from app.config.mlflow_config import configure_mlflow
from app.module.llm_assistant.exception.llm_exception import (
    ConversationNotFoundError,
    EvaluationRunNotFoundError,
    KnowledgeChunkNotFoundError,
    LlmProviderError,
    MessageNotFoundError,
    ToolCallNotFoundError,
)
from app.module.llm_assistant.ml import llm_evaluator, rag_retriever
from app.module.llm_assistant.ml.guardrails import guard_input, guard_output
from app.module.llm_assistant.ml.llm_provider import ChatMessage, LlmProvider, ToolRequest
from app.module.llm_assistant.ml.ollama_provider import select_provider
from app.module.llm_assistant.ml.prompt_builder import build_prompt
from app.module.llm_assistant.ml.rag_retriever import Source
from app.module.llm_assistant.ml.response_streamer import sse
from app.module.llm_assistant.ml.tool_executor import ToolExecutor, get_http_client
from app.module.llm_assistant.ml.tool_registry import TOOL_SCHEMAS
from app.module.llm_assistant.model.llm_model import (
    KnowledgeChunk,
    LlmConversation,
    LlmEvaluationRun,
    LlmMessage,
    LlmToolCall,
)
from app.module.llm_assistant.repository.llm_repository import LlmRepository
from app.module.natural_language.ml import context_manager
from app.shared.constants.ml_constants import MAX_TOOL_CALLS_PER_TURN
from app.shared.middleware.auth_middleware import AuthUser, ensure_owner
from app.shared.types.common_types import PageMeta
from app.shared.types.ml_types import JobStatus
from app.shared.util.pagination_util import PageParams

HISTORY_LIMIT = 100  # Mensajes devueltos por GET /conversations/:id (los más recientes)
TITLE_LENGTH = 80
INDEX_TASK = "llm_assistant.index_knowledge"
EVALUATE_TASK = "llm_assistant.evaluate"

Retriever = Callable[[str, str | None], Awaitable[list[Source]]]  # (pregunta, idioma) -> fuentes


# ProviderFactory => firma de select_provider (Protocol: cualquier callable compatible sirve, p. ej.
# un proveedor falso en las pruebas)
class ProviderFactory(Protocol):
    def __call__(
        self, question: str, tier: str | None = None, cache: bool = True
    ) -> LlmProvider: ...


# Turn => Value Object con todo lo que el stream necesita (validado ANTES de abrir el SSE)
@dataclass(frozen=True)
class Turn:
    user: AuthUser
    conversation_id: str
    question: str
    prompt: list[ChatMessage]
    sources: list[Source]


def _context_key(conversation_id: str) -> str:
    return f"llm:{conversation_id}"  # Redis: ml:chat:llm:<id> (no choca con el chatbot de 5.3)


async def _no_context(question: str, lang: str | None) -> list[Source]:
    return []


class LlmService:
    def __init__(
        self,
        repository: LlmRepository,
        providers: ProviderFactory,
        tools: ToolExecutor | None = None,
        retrieve: Retriever = _no_context,
    ) -> None:
        self.repository = repository
        self.providers = providers
        self.tools = tools  # None => el modelo solo responde texto (sin tool use)
        self.retrieve = retrieve

    # ---------- Conversaciones (5B.4) ----------
    async def create(self, user: AuthUser) -> LlmConversation:
        conversation = await self.repository.add(LlmConversation(user_id=user.id))
        await self.repository.commit()
        return conversation

    async def list_page(
        self, user: AuthUser, cursor: datetime | None, limit: int
    ) -> tuple[list[LlmConversation], datetime | None]:
        # Pide 1 de más: si llega, hay otra página y su cursor es la última fila mostrada
        rows = await self.repository.list_by_user(user.id, cursor, limit + 1)
        page = rows[:limit]
        return page, (page[-1].updated_at if len(rows) > limit else None)

    async def get(self, user: AuthUser, conversation_id: str) -> LlmConversation:
        if (conversation := await self.repository.get(conversation_id)) is None:
            raise ConversationNotFoundError(conversation_id)
        ensure_owner(user, conversation.user_id)  # Solo el propietario (o ADMIN/SERVICE): IDOR
        return conversation

    async def messages(self, conversation_id: str) -> list[LlmMessage]:
        return await self.repository.messages(conversation_id, HISTORY_LIMIT)

    async def list_messages(self, user: AuthUser, conversation_id: str) -> list[LlmMessage]:
        await self.get(user, conversation_id)  # Verifica propietario
        return await self.messages(conversation_id)

    async def get_message(
        self, user: AuthUser, conversation_id: str, message_id: str
    ) -> tuple[LlmMessage, list[LlmToolCall]]:
        await self.get(user, conversation_id)
        if (message := await self.repository.get_message(conversation_id, message_id)) is None:
            raise MessageNotFoundError(message_id)
        return message, await self.repository.message_tool_calls(message_id)

    async def delete(self, user: AuthUser, conversation_id: str) -> None:
        await self.repository.delete(await self.get(user, conversation_id))  # CASCADE: mensajes
        await self.repository.commit()
        await context_manager.clear(_context_key(conversation_id))

    # start_turn => guardrails, RAG y guardado del mensaje ANTES de abrir el stream: así un
    # 404/403/422 llega como respuesta JSON normal y no como evento SSE ya iniciado
    async def start_turn(
        self, user: AuthUser, conversation_id: str, content: str, lang: str | None = None
    ) -> Turn:
        conversation = await self.get(user, conversation_id)
        question = guard_input(content)  # 422 si trae secretos; PII redactada (no se guarda)
        sources = await self.retrieve(question, lang)
        prompt = build_prompt(await self._history(conversation_id), question, sources)
        if conversation.title is None:
            conversation.title = question[:TITLE_LENGTH]
        conversation.updated_at = func.now()  # Sube la conversación al inicio del listado
        await self.repository.add_message(
            LlmMessage(conversation_id=conversation_id, role="user", content=question)
        )
        await self.repository.commit()
        return Turn(user, conversation_id, question, prompt, sources)

    # reply => generador asíncrono de eventos SSE: "token" por fragmento, "tool" al consultar una
    # herramienta, "done" al guardar la respuesta y "error" si el proveedor falla a mitad (los
    # headers HTTP ya se enviaron)
    async def reply(self, turn: Turn) -> AsyncIterator[str]:
        started, parts, audits = time.perf_counter(), [], []
        provider = self.providers(turn.question)
        try:
            requests: list[ToolRequest] = []
            tools = TOOL_SCHEMAS if self.tools else None
            async for part in provider.stream(turn.prompt, tools):
                if isinstance(part, ToolRequest):
                    requests.append(part)
                else:
                    parts.append(part)
                    yield sse("token", {"text": part})
            if requests and self.tools:  # Una sola ronda: la 2.ª llamada va sin herramientas
                requests = requests[:MAX_TOOL_CALLS_PER_TURN]
                messages = [*turn.prompt, _tool_call_message("".join(parts), requests)]
                for request in requests:
                    yield sse("tool", {"name": request.name})  # La UI puede mostrar "consultando…"
                    result, audit = await self.tools.execute(
                        turn.user, turn.conversation_id, request
                    )
                    audits.append(audit)
                    messages.append({"role": "tool", "content": result, "tool_name": request.name})
                async for part in provider.stream(messages):
                    if isinstance(part, str):
                        parts.append(part)
                        yield sse("token", {"text": part})
        except LlmProviderError as error:
            yield sse("error", {"code": error.code, "message": error.message})
            return
        # "join" => una sola concatenación (no += por token); guardrail de salida antes de guardar
        answer = guard_output("".join(parts).strip())
        message = await self.repository.add_message(
            LlmMessage(
                conversation_id=turn.conversation_id,
                role="assistant",
                content=answer,
                model=provider.name,
                latency_ms=int((time.perf_counter() - started) * 1000),
                sources=[source.citation() for source in turn.sources] or None,
            )
        )
        for audit in audits:
            audit.message_id = message.id
        await self.repository.save(*audits)
        await self.repository.commit()
        await context_manager.append(
            _context_key(turn.conversation_id),
            {"role": "user", "content": turn.question},
            {"role": "assistant", "content": answer},
        )
        yield sse("done", {"message_id": message.id, "latency_ms": message.latency_ms})

    async def feedback(
        self, user: AuthUser, conversation_id: str, message_id: str, value: str
    ) -> LlmMessage:
        await self.get(user, conversation_id)  # Verifica propietario
        message = await self.repository.get_message(conversation_id, message_id)
        if message is None or message.role != "assistant":  # Solo se califican respuestas
            raise MessageNotFoundError(message_id)
        message.feedback = value
        await self.repository.commit()
        return message

    async def _history(self, conversation_id: str) -> list[ChatMessage]:
        if history := await context_manager.history(_context_key(conversation_id)):
            return history
        # TTL vencido (o Redis caído): misma ventana leída de PostgreSQL
        recent = await self.repository.messages(conversation_id, context_manager.WINDOW)
        return [{"role": m.role, "content": m.content} for m in recent]

    # ---------- Conocimiento RAG (5B.2) ----------
    def enqueue_index(self, sources: list[str], product_ids: list[str] | None) -> str:
        return celery_app.send_task(INDEX_TASK, args=[sources, product_ids]).id

    async def list_chunks(
        self, source: str | None, lang: str | None, params: PageParams
    ) -> tuple[list[KnowledgeChunk], PageMeta]:
        return await self.repository.list_chunks(source, lang, params)

    async def get_chunk(self, chunk_id: str) -> KnowledgeChunk:
        if (chunk := await self.repository.find(KnowledgeChunk, chunk_id)) is None:
            raise KnowledgeChunkNotFoundError(chunk_id)
        return chunk

    async def delete_chunk(self, chunk_id: str) -> None:
        await self.repository.session.delete(await self.get_chunk(chunk_id))
        await self.repository.commit()

    async def delete_all_chunks(self) -> int:
        deleted = await self.repository.delete_all_chunks()
        await self.repository.commit()
        return deleted

    # ---------- Auditoría de herramientas (5B.3) ----------
    async def list_tool_calls(
        self, tool: str | None, status: str | None, params: PageParams
    ) -> tuple[list[LlmToolCall], PageMeta]:
        return await self.repository.list_tool_calls(tool, status, params)

    async def get_tool_call(self, tool_call_id: str) -> LlmToolCall:
        if (call := await self.repository.find(LlmToolCall, tool_call_id)) is None:
            raise ToolCallNotFoundError(tool_call_id)
        return call

    # ---------- Evaluaciones (5B.5) ----------
    async def enqueue_evaluation(self, tier: str) -> LlmEvaluationRun:
        run = LlmEvaluationRun(tier=tier)
        await self.repository.save(run)
        await self.repository.commit()
        celery_app.send_task(EVALUATE_TASK, args=[run.id])
        return run

    # run_evaluation => corre en el worker: set de preguntas -> métricas -> BD + MLflow
    async def run_evaluation(self, run_id: str) -> None:
        if (run := await self.repository.find(LlmEvaluationRun, run_id)) is None:
            return
        run.status = JobStatus.RUNNING
        await self.repository.commit()
        try:
            provider = self.providers("", tier=run.tier, cache=False)  # Latencia real, sin caché
            results = await llm_evaluator.evaluate(provider, self.retrieve)
            summary = llm_evaluator.summarize(results)
            run.model, run.details = provider.name, results
            for field, value in summary.items():
                setattr(run, field, value)  # "setattr" => asigna un atributo por nombre
            run.mlflow_run_id = _log_mlflow(run.tier, provider.name, summary)
            run.status = JobStatus.DONE
        except Exception as error:  # El fallo queda visible en la corrida
            run.status, run.error = JobStatus.FAILED, str(error)
        run.finished_at = datetime.now(UTC)
        await self.repository.commit()

    async def list_evaluations(self, params: PageParams) -> tuple[list[LlmEvaluationRun], PageMeta]:
        return await self.repository.list_evaluations(params)

    async def get_evaluation(self, run_id: str) -> LlmEvaluationRun:
        if (run := await self.repository.find(LlmEvaluationRun, run_id)) is None:
            raise EvaluationRunNotFoundError(run_id)
        return run

    async def delete_evaluation(self, run_id: str) -> None:
        await self.repository.session.delete(await self.get_evaluation(run_id))
        await self.repository.commit()


# _tool_call_message => turno del asistente que pidió herramientas (formato de Ollama/OpenAI)
def _tool_call_message(content: str, requests: list[ToolRequest]) -> ChatMessage:
    return {
        "role": "assistant",
        "content": content,
        "tool_calls": [{"function": {"name": r.name, "arguments": r.arguments}} for r in requests],
    }


def _log_mlflow(tier: str, model: str, summary: dict[str, Any]) -> str:
    configure_mlflow("llm_assistant")
    with mlflow.start_run(run_name=f"llm-eval-{tier}") as run:
        mlflow.log_params({"tier": tier, "model": model, "top_k": get_llm_settings().RAG_TOP_K})
        mlflow.log_metrics({k: float(v) for k, v in summary.items()})
        return run.info.run_id


# build_llm_service => Factory (Composition): repositorio de la sesión + gateway por pregunta +
# herramientas con el cliente HTTP Singleton + RAG pgvector sobre la misma sesión. La usan el
# controller (por request) y el worker de Celery (por tarea)
def build_llm_service(session: AsyncSession) -> LlmService:
    settings = get_llm_settings()
    return LlmService(
        LlmRepository(session),
        select_provider,
        ToolExecutor(get_http_client()) if settings.LLM_TOOLS_ENABLED else None,
        # "partial" => fija la sesión: queda retrieve(question, lang)
        partial(rag_retriever.retrieve, session),
    )
