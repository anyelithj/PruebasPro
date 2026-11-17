"""Router del modulo Assistant.

[Patron]: Controller (MVC) + Facade + Composition Root (AgentFactory con tutor y guía).
[Principio]: SRP.
[Paradigma]: Funcional + asincrono.
[Sprint 7.9]: persona «guide» (FAQ → manual → LLM), índices FAISS de FAQ y manual que alimenta NestJS Help, y borrado de la conversación propia.
"""
import asyncio
import json
import re
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse

from src.modules.assistant.application.schemas.chat_request import ChatRequest, LanguageUsageRequest
from src.modules.assistant.application.schemas.chat_response import ChatResponse, LanguageUsageOut
from src.modules.assistant.application.schemas.knowledge_response import (  # [OpenAPI]: DTOs de salida → Swagger con esquema real
    ConversationOut,
    FaqEmbedOut,
    KnowledgeStatusOut,
    UserWordsIn,
    UserWordsOut,
    KnowledgeSyncIn,
    KnowledgeSyncOut,
    ManualReindexOut,
    ReindexKnowledgeOut,
)
from src.modules.assistant.application.use_cases.chat_with_agent import (
    ChatWithAgentUseCase,
)
from src.modules.assistant.application.use_cases.get_conversation import (
    GetConversationUseCase,
)
from src.modules.assistant.application.use_cases.reindex_knowledge import (
    ReindexKnowledgeUseCase,
    SyncKnowledgeUseCase,
)
from src.modules.assistant.application.use_cases.reindex_manual import (
    ManualArticleIn,
    ReindexManualUseCase,
)
from src.modules.assistant.application.use_cases.search_faq import SearchFaqUseCase
from src.modules.assistant.application.use_cases.upsert_faq_embeddings import (
    FaqIn,
    UpsertFaqEmbeddingsUseCase,
)
from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc, VectorStore
from src.modules.assistant.domain.value_objects.language_usage import measure_conversation
from src.modules.assistant.infrastructure.agents.agent_factory import AgentFactory
from src.modules.assistant.infrastructure.agents.guide_agent import GuideAgent
from src.modules.assistant.infrastructure.agents.game_agent import GameAgent
from src.modules.assistant.infrastructure.agents.dialogue_agent import DialogueAgent
from src.modules.assistant.infrastructure.agents.tutor_agent import TutorAgent
from src.modules.assistant.infrastructure.clients.faq_retriever import get_faq_retriever
from src.modules.assistant.infrastructure.clients.manual_retriever import get_manual_retriever
from src.modules.assistant.domain.interfaces.conversation_repository import ConversationRepository
from src.modules.assistant.infrastructure.repositories.conversation_repository import build_conversation_repository
from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
from src.modules.assistant.infrastructure.repositories.knowledge_repository import (
    SqlKnowledgeRepository,
)
from src.modules.feedback.infrastructure.clients.rag_retriever import get_rag_retriever
from src.modules.language_tools.infrastructure.clients.espeak_phonetizer import get_phonetizer  # [Tarea 9]: pronunciación por diccionario
from src.shared.config.settings import get_settings
from src.shared.dependencies.auth_deps import CurrentUserDep, require_role
from src.shared.dependencies.db_deps import DbSessionDep

router = APIRouter(prefix="/assistant", tags=["assistant"])


@lru_cache(maxsize=1)
def _get_repo() -> ConversationRepository:
    # [Composition Root · Tarea 1]: Redis compartido entre workers (RNF-06); memoria solo si Redis no responde al arrancar
    s = get_settings()
    return build_conversation_repository(s.redis_url, s.conversation_ttl_seconds)


@lru_cache(maxsize=1)
def _get_ollama() -> OllamaClient:
    # [2026-10-20]: 75 s (< 90 s de NestJS) → la carga en frío del modelo (~36 s en CPU) ya no cae al texto de respaldo
    return OllamaClient(timeout=75.0)


@lru_cache(maxsize=1)
def _get_agents() -> AgentFactory:
    # [Composition Root]: un agente por persona; ambos comparten el mismo cliente de Ollama y el mismo codificador
    s = get_settings()
    guide = GuideAgent(
        _get_ollama(),
        SearchFaqUseCase(get_faq_retriever(), s.guide_faq_threshold),
        get_manual_retriever(),
        s.guide_manual_threshold,
    )
    # [2026-10-19]: «support» = mismo agente con instrucciones de soporte (el chatbot flotante ofrece Tutor · Soporte · Guía)
    support = GuideAgent(
        _get_ollama(),
        SearchFaqUseCase(get_faq_retriever(), s.guide_faq_threshold),
        get_manual_retriever(),
        s.guide_manual_threshold,
        mode="support",
    )
    return AgentFactory(
        {"tutor": TutorAgent(_get_ollama(), get_rag_retriever(), get_phonetizer()), "guide": guide, "support": support, "game": GameAgent(_get_ollama()), "dialogue": DialogueAgent(_get_ollama())}  # [Sprints 8.7 y 9.6]
    )


def get_chat_use_case() -> ChatWithAgentUseCase:
    return ChatWithAgentUseCase(_get_repo(), _get_agents())


def _required(store: VectorStore | None) -> VectorStore:
    """Sin codificador no hay índice → 503 (mismo mensaje que el reindexado del tutor)."""
    if store is None:
        raise HTTPException(status_code=503, detail="Modelo de embeddings no disponible")
    return store


def get_conversation_use_case() -> GetConversationUseCase:
    return GetConversationUseCase(_get_repo())


# `summary` (FastAPI): título de la operación en /api/v1/docs · [2026-11-17]: toda ruta documentada en OpenAPI
@router.get("/health", summary="Estado del módulo assistant (comprobación de vida)")
async def health() -> dict[str, str]:
    return {"module": "assistant", "status": "ready"}


@router.get("/knowledge", response_model=KnowledgeStatusOut, summary="Estado de la base de conocimiento del tutor (RAG)")
async def knowledge(_user: CurrentUserDep) -> dict[str, object]:
    store, faq, manual = get_rag_retriever().store, get_faq_retriever().store, get_manual_retriever().store
    return {
        "available": store is not None,
        "documents": store.size if store else 0,
        "faq": faq.size if faq else 0,  # [Sprint 7.9]: FAQ indexadas para el Agente Guía
        "manual_sections": manual.size if manual else 0,
    }


@router.post(
    "/knowledge/reindex",
    response_model=ReindexKnowledgeOut,  # `response_model` (FastAPI): valida el dict y publica su esquema
    summary="Reconstruye el índice FAISS desde los recursos curriculares aprobados",
    dependencies=[Depends(require_role("ADMIN"))],
)
async def reindex_knowledge(session: DbSessionDep) -> dict[str, object]:
    store = get_rag_retriever().store
    if store is None:
        raise HTTPException(status_code=503, detail="Modelo de embeddings no disponible")
    return await ReindexKnowledgeUseCase(SqlKnowledgeRepository(session), store).execute()


@router.post(
    "/knowledge/sync",
    response_model=KnowledgeSyncOut,
    summary="Actualiza en el índice los fragmentos de los recursos que cambiaron (lo llama NestJS Curriculum)",
    # [Tarea 9]: el autor que confirma el alta, la importación, la edición o la baja es TEACHER o ADMIN (NestJS firma un token de servicio)
    dependencies=[Depends(require_role("TEACHER", "ADMIN"))],
)
async def sync_knowledge(payload: KnowledgeSyncIn, session: DbSessionDep) -> dict[str, object]:
    return await SyncKnowledgeUseCase(SqlKnowledgeRepository(session), _required(get_rag_retriever().store)).execute(payload.ids)


@router.post(
    "/knowledge/user-words",
    response_model=UserWordsOut,
    summary="Indexa las palabras que el usuario marcó para aprender (fragmentos privados del tutor)",
)
async def index_user_words(payload: UserWordsIn, user: CurrentUserDep) -> dict[str, object]:
    # [2026-11-14 · RF-137]: el dueño SALE DEL TOKEN (nunca del cuerpo) → nadie indexa palabras en nombre de otro
    # Solo términos sueltos con su traducción: los libros y textos completos no entran al índice
    docs = [
        KnowledgeDoc(
            id=f"user:{user.id}:{w.id}",
            language=w.language,
            level="",
            kind="vocabulary",
            topic="Mis palabras para aprender",
            text=f"{w.term} = {w.translation}" if w.translation else w.term,
            owner=user.id,
        )
        for w in payload.words
    ]
    store = _required(get_rag_retriever().store)
    return {"indexed": await asyncio.to_thread(store.replace_resources, [], docs)}


@router.post(
    "/knowledge/faq/embed",
    response_model=FaqEmbedOut,
    summary="Reconstruye el índice de FAQ del Agente Guía con las publicadas (lo llama NestJS Help)",
    dependencies=[Depends(require_role("ADMIN"))],
)
async def embed_faqs(faqs: Annotated[list[FaqIn], Body(max_length=2000)]) -> dict[str, object]:
    return await UpsertFaqEmbeddingsUseCase(_required(get_faq_retriever().store)).execute(faqs)


@router.post(
    "/knowledge/manual/reindex",
    response_model=ManualReindexOut,
    summary="Divide el manual por secciones y reconstruye su índice (lo llama NestJS Help)",
    dependencies=[Depends(require_role("ADMIN"))],
)
async def reindex_manual(articles: Annotated[list[ManualArticleIn], Body(max_length=500)]) -> dict[str, object]:
    return await ReindexManualUseCase(_required(get_manual_retriever().store)).execute(articles)


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Conversa con el tutor IA (JSON simple)",
)
async def chat(
    payload: ChatRequest,
    user: CurrentUserDep,
    use_case: Annotated[ChatWithAgentUseCase, Depends(get_chat_use_case)],
) -> ChatResponse:
    return await use_case.execute(payload, user.id, user.role)


@router.post(
    "/chat/stream",
    summary="Conversa con el tutor IA (SSE streaming)",
    # [OpenAPI · Sprint 11.2]: `response_class` (FastAPI) + `responses` → documenta `text/event-stream` en vez de un JSON vacío | [Principio]: contrato explícito
    response_class=StreamingResponse,
    responses={200: {"description": "Flujo SSE: eventos `data:` con fragmentos de texto", "content": {"text/event-stream": {"schema": {"type": "string"}}}}},
)
async def chat_stream(
    payload: ChatRequest,
    user: CurrentUserDep,
    use_case: Annotated[ChatWithAgentUseCase, Depends(get_chat_use_case)],
) -> StreamingResponse:
    # [SSE]: por ahora envia respuesta completa palabra-a-palabra (pseudo-streaming).
    # Real streaming desde Ollama llega en Sprint 4.
    # [Fix 2026-10-27]: la respuesta se calcula ANTES de abrir el flujo → un fallo sale como HTTP 5xx real (NestJS lo detecta y responde desde la FAQ/manual)
    # en vez de un 200 con el flujo cortado a medias (antes el error ocurría dentro del generador, con las cabeceras ya enviadas)
    response = await use_case.execute(payload, user.id, user.role)

    async def event_generator():
        # [Header sesion]: el cliente lo necesita en el primer evento
        yield f"event: session\ndata: {json.dumps({'session_id': response.session_id})}\n\n"
        # `\S+\s*` (re): palabra + su espacio original → los saltos de línea de los pasos numerados del Agente Guía se conservan
        for token in re.findall(r"\S+\s*", response.reply):
            yield f"event: token\ndata: {json.dumps({'text': token})}\n\n"
            await asyncio.sleep(0.02)
        # [Sprint 7.9]: citas y origen de la respuesta antes de cerrar (el Agente Guía las muestra bajo el mensaje)
        meta = {
            "sources": [s.model_dump() for s in response.sources],
            "answered_by": response.answered_by,
            "game": response.game,
            "dialogue": response.dialogue,
            # [2026-10-28]: uso del idioma meta (solo tutor) → indicador «Uso del idioma: 45 % / meta 60 %»
            "language_usage": response.language_usage.model_dump() if response.language_usage else None,
        }
        yield f"event: sources\ndata: {json.dumps(meta)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# [POST /language-usage · 2026-10-28]: recalcula el % de palabras en el idioma meta de un historial (NestJS lo llama tras borrar o editar mensajes)
# Sin LLM ni estado (< 1 ms por mensaje) | [Principio]: SSOT — la regla de medición y la meta por nivel viven solo en language_usage.py
@router.post("/language-usage", response_model=LanguageUsageOut, summary="Uso del idioma meta en un historial (sin LLM)")
async def language_usage(payload: LanguageUsageRequest, _user: CurrentUserDep) -> LanguageUsageOut:
    usage = measure_conversation(payload.messages, payload.language, payload.level)
    return LanguageUsageOut(**usage.to_dict())  # type: ignore[arg-type]


@router.get("/conversation/{session_id}", response_model=ConversationOut, summary="Lee la conversacion completa")
async def get_conversation(
    session_id: str,
    user: CurrentUserDep,
    use_case: Annotated[GetConversationUseCase, Depends(get_conversation_use_case)],
) -> dict:
    conv = await use_case.execute(session_id)
    if conv.user_id != user.id:  # [Seguridad]: la conversación de otro usuario «no existe» (sin revelar que sí existe)
        raise HTTPException(status_code=404, detail=f"Conversation {session_id} not found")
    return {
        "id": conv.id,
        "user_id": conv.user_id,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp.isoformat(),
            }
            for m in conv.messages
        ],
        "created_at": conv.created_at.isoformat(),
    }


@router.delete("/conversation/{session_id}", status_code=204, summary="Borra la conversación propia (Agente Guía)")
async def delete_conversation(session_id: str, user: CurrentUserDep) -> None:
    repo = _get_repo()
    conv = await repo.find(session_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail=f"Conversation {session_id} not found")
    await repo.delete(session_id)
