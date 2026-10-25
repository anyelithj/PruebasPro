# fraud_detection_controller.py (FastAPI + Strawberry) => traduce HTTP/GraphQL <-> casos de uso de
# fraude. Patrón: Controller + DI + Adapter (GraphQL). Paradigma: asíncrono.

from typing import Annotated, Literal

import strawberry
from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON

from app.config.database_config import get_session
from app.module.fraud_detection.repository.fraud_detection_repository import (
    FraudDetectionRepository,
)
from app.module.fraud_detection.schema.fraud_detection_schema import (
    AlertResponse,
    AnalysisResponse,
    AnalyzeRequest,
    DismissRequest,
)
from app.module.fraud_detection.service.fraud_detection_service import FraudDetectionService
from app.shared.middleware.auth_middleware import CurrentUser
from app.shared.types.common_types import ApiResponse
from app.shared.util.pagination_util import Page


def build_service(session: AsyncSession) -> FraudDetectionService:
    return FraudDetectionService(FraudDetectionRepository(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> FraudDetectionService:
    return build_service(session)


Service = Annotated[FraudDetectionService, Depends(get_service)]


# createFraudAnalysis() — POST /analyze
async def create_fraud_analysis(
    body: AnalyzeRequest, service: Service
) -> ApiResponse[AnalysisResponse]:
    features = body.model_dump(exclude={"user_id", "order_id"})
    return ApiResponse(
        data=AnalysisResponse.model_validate(
            await service.analyze(body.user_id, body.order_id, features)
        )
    )


# listFraudAlerts() — GET /alert?status=&level=&page=&limit=
async def list_fraud_alerts(
    service: Service,
    params: Page,
    status: Annotated[Literal["OPEN", "DISMISSED"] | None, Query()] = None,
    level: Annotated[Literal["MEDIUM", "HIGH"] | None, Query()] = None,
) -> ApiResponse[list[AlertResponse]]:
    alerts, meta = await service.list_alerts(status, level, params)
    return ApiResponse(data=[AlertResponse.model_validate(alert) for alert in alerts], meta=meta)


# getFraudAlertById() — GET /alert/:id
async def get_fraud_alert_by_id(alert_id: str, service: Service) -> ApiResponse[AlertResponse]:
    return ApiResponse(data=AlertResponse.model_validate(await service.get_alert(alert_id)))


# updateAlertDismissal() — PATCH /alert/:id/dismiss
async def update_alert_dismissal(
    alert_id: str, body: DismissRequest, service: Service, user: CurrentUser
) -> ApiResponse[AlertResponse]:
    alert = await service.dismiss(user, alert_id, body.reason, body.notes)
    return ApiResponse(data=AlertResponse.model_validate(alert))


# --- GraphQL ---
@strawberry.type
class FraudAlertType:
    id: str
    risk_level: str
    status: str
    analysis: JSON


@strawberry.type
class FraudQuery:
    @strawberry.field
    async def fraud_alert(self, info: strawberry.Info, id: str) -> FraudAlertType:
        dto = AlertResponse.model_validate(
            await build_service(info.context["session"]).get_alert(id)
        )
        return FraudAlertType(
            id=dto.id,
            risk_level=dto.risk_level,
            status=dto.status,
            analysis=dto.analysis.model_dump(mode="json"),
        )
