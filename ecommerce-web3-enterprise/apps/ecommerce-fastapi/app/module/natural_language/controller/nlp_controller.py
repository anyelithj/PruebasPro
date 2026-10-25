# nlp_controller.py (FastAPI + Strawberry) => traduce HTTP/GraphQL <-> casos de uso de lenguaje
# natural. Patrón: Controller + DI + Adapter (GraphQL). Paradigma: asíncrono.

from typing import Annotated

import strawberry
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON

from app.config.database_config import get_session
from app.module.natural_language.repository.nlp_repository import NlpRepository
from app.module.natural_language.schema.nlp_schema import (
    ChatSessionResponse,
    IntentRequest,
    LlmResponseOut,
    MessageRequest,
    NlpResultResponse,
    TrainingExampleIn,
    TrainingExampleOut,
    TrainingExamplePatch,
)
from app.module.natural_language.service.nlp_service import NlpService
from app.shared.middleware.auth_middleware import CurrentUser
from app.shared.types.common_types import ApiResponse
from app.shared.util.pagination_util import Page


def build_service(session: AsyncSession) -> NlpService:
    return NlpService(NlpRepository(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> NlpService:
    return build_service(session)


Service = Annotated[NlpService, Depends(get_service)]


# createNlpResult() — POST /intent
async def create_nlp_result(
    body: IntentRequest, service: Service, _: CurrentUser
) -> ApiResponse[NlpResultResponse]:
    result = await service.detect(body.text, body.conversation_id)
    return ApiResponse(data=NlpResultResponse.model_validate(result))


# createLlmResponse() — POST /message
async def create_llm_response(
    body: MessageRequest, service: Service, user: CurrentUser
) -> ApiResponse[LlmResponseOut]:
    response = await service.message(user, body.session_id, body.message)
    return ApiResponse(data=LlmResponseOut.model_validate(response))


# getChatSessionById() — GET /session/:id
async def get_chat_session_by_id(
    session_id: str, service: Service, user: CurrentUser
) -> ApiResponse[ChatSessionResponse]:
    return ApiResponse(
        data=ChatSessionResponse.model_validate(await service.get_session(user, session_id))
    )


# deleteChatSessionById() — DELETE /session/:id => 204
async def delete_chat_session_by_id(session_id: str, service: Service, user: CurrentUser) -> None:
    await service.delete_session(user, session_id)


# ---------- RF-17.13 entrenamiento continuo (ADMIN / SERVICE: guard del router) ----------
# listTraining() — GET /training?approved=
async def list_training(
    service: Service, params: Page, approved: bool | None = None
) -> ApiResponse[list[TrainingExampleOut]]:
    rows, meta = await service.training_page(approved, params)
    return ApiResponse(data=[TrainingExampleOut.model_validate(r) for r in rows], meta=meta)


# createTraining() — POST /training (ejemplo etiquetado por un asesor)
async def create_training(
    body: TrainingExampleIn, service: Service
) -> ApiResponse[TrainingExampleOut]:
    example = await service.add_example(
        body.text, body.intent, [e.model_dump() for e in body.entities]
    )
    return ApiResponse(data=TrainingExampleOut.model_validate(example))


# updateTraining() — PATCH /training/:id (corregir intención/entidades, aprobar o rechazar)
async def update_training(
    example_id: str, body: TrainingExamplePatch, service: Service
) -> ApiResponse[TrainingExampleOut]:
    changes = body.model_dump(exclude_none=True)
    return ApiResponse(
        data=TrainingExampleOut.model_validate(await service.label(example_id, changes))
    )


# deleteTraining() — DELETE /training/:id => 204
async def delete_training(example_id: str, service: Service) -> None:
    await service.remove_example(example_id)


# getNluMetrics() — GET /metrics (RF-17.12 precisión de intenciones y entidades)
async def get_nlu_metrics(service: Service) -> ApiResponse[dict]:
    return ApiResponse(data=await service.metrics())


# --- GraphQL (solo ADMIN: guard del router GraphQL) ---
@strawberry.type
class ChatSessionType:
    id: str
    user_id: str
    messages: JSON


@strawberry.type
class NlpQuery:
    @strawberry.field
    async def chat_session(self, info: strawberry.Info, id: str) -> ChatSessionType:
        chat = await build_service(info.context["session"]).get_session(info.context["user"], id)
        return ChatSessionType(id=chat.id, user_id=chat.user_id, messages=chat.messages)
