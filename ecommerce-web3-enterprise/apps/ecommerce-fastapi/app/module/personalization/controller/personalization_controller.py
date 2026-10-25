# personalization_controller.py (FastAPI + Strawberry) => traduce HTTP/GraphQL <-> casos de uso de
# personalización. Patrón: Controller + DI + Adapter (GraphQL). Paradigma: asíncrono.

from typing import Annotated

import strawberry
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON

from app.config.database_config import get_session
from app.module.personalization.repository.personalization_repository import (
    PersonalizationRepository,
)
from app.module.personalization.schema.personalization_schema import (
    FeedbackRequest,
    InteractionResponse,
    RecoResponse,
    TrainResponse,
)
from app.module.personalization.service.personalization_service import PersonalizationService
from app.shared.middleware.auth_middleware import CurrentUser
from app.shared.types.common_types import ApiResponse


def build_service(session: AsyncSession) -> PersonalizationService:
    return PersonalizationService(PersonalizationRepository(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> PersonalizationService:
    return build_service(session)


Service = Annotated[PersonalizationService, Depends(get_service)]


# getPersonalizationProfileById() — GET /:id (id = usuario)
async def get_personalization_profile_by_id(
    user_id: str, service: Service, user: CurrentUser
) -> ApiResponse[RecoResponse]:
    return ApiResponse(
        data=RecoResponse.model_validate(await service.recommendations(user, user_id))
    )


# createInteractionRecord() — POST /feedback
async def create_interaction_record(
    body: FeedbackRequest, service: Service, user: CurrentUser
) -> ApiResponse[InteractionResponse]:
    record = await service.record_feedback(user, body.product_id, body.event, body.user_id)
    return ApiResponse(data=InteractionResponse.model_validate(record))


# deleteInteractionRecordById() — DELETE /interaction/:id => 204
async def delete_interaction_record_by_id(
    interaction_id: str, service: Service, user: CurrentUser
) -> None:
    await service.delete_interaction(user, interaction_id)


# createPersonalizationModel() — POST /model/train => 202
async def create_personalization_model(service: Service) -> ApiResponse[TrainResponse]:
    model, job_id = await service.enqueue_training()
    return ApiResponse(
        data=TrainResponse(
            job_id=job_id, model_id=model.id, version=model.version, status=model.status
        )
    )


# --- GraphQL ---
@strawberry.type
class RecommendationsType:
    user_id: str
    recommendations: JSON


@strawberry.type
class PersonalizationQuery:
    @strawberry.field
    async def recommendations(self, info: strawberry.Info, user_id: str) -> RecommendationsType:
        profile = await build_service(info.context["session"]).recommendations(
            info.context["user"], user_id
        )
        return RecommendationsType(user_id=profile.user_id, recommendations=profile.recommendations)
