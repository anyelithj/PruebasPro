# sentiment_controller.py (FastAPI + Strawberry) => traduce HTTP/GraphQL <-> casos de uso de
# sentimiento. Sin lógica de negocio (SRP). Patrón: Controller + DI (Depends) + Adapter (GraphQL).
# Paradigma: asíncrono + declarativo.

from typing import Annotated, Literal

import strawberry
from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database_config import get_session
from app.module.sentiment_analysis.ml.social_insights import insights
from app.module.sentiment_analysis.repository.sentiment_repository import SentimentRepository
from app.module.sentiment_analysis.schema.sentiment_schema import (
    AggregateResponse,
    AnalyzeRequest,
    InsightsRequest,
    InsightsResponse,
    SentimentResponse,
)
from app.module.sentiment_analysis.service.sentiment_service import SentimentService
from app.shared.types.common_types import ApiResponse


def build_service(session: AsyncSession) -> SentimentService:
    return SentimentService(SentimentRepository(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> SentimentService:
    return build_service(session)


Service = Annotated[SentimentService, Depends(get_service)]


# createSocialInsights() — POST /insights (RF-15.11): sin base de datos ni modelo (léxico puro)
async def create_social_insights(body: InsightsRequest) -> ApiResponse[InsightsResponse]:
    result = insights([item.model_dump() for item in body.texts])
    return ApiResponse(data=InsightsResponse.model_validate(result))


# createSentimentResult() — POST /analyze
async def create_sentiment_result(
    body: AnalyzeRequest, service: Service
) -> ApiResponse[SentimentResponse]:
    result = await service.analyze(body.text, body.product_id, body.review_id)
    return ApiResponse(data=SentimentResponse.model_validate(result))


# listSentimentAggregates() — GET /aggregate?product_id=&period=7d
async def list_sentiment_aggregates(
    service: Service,
    product_id: Annotated[str | None, Query(max_length=36)] = None,
    period: Annotated[Literal["7d", "30d", "90d"], Query()] = "7d",
) -> ApiResponse[AggregateResponse]:
    return ApiResponse(
        data=AggregateResponse(**await service.aggregate(product_id=product_id, period=period))
    )


# getSentimentResultById() — GET /:id
async def get_sentiment_result_by_id(
    result_id: str, service: Service
) -> ApiResponse[SentimentResponse]:
    return ApiResponse(data=SentimentResponse.model_validate(await service.get(result_id)))


# deleteAllSentimentResults() — DELETE /analysis-cache
async def delete_all_sentiment_results(service: Service) -> ApiResponse[dict[str, int]]:
    return ApiResponse(data={"deleted": await service.clear_cache()})


# --- GraphQL ---
@strawberry.type
class SentimentType:
    id: str
    label: str
    score: float
    product_id: str | None
    created_at: str


@strawberry.type
class SentimentQuery:
    @strawberry.field
    async def sentiment_result(self, info: strawberry.Info, id: str) -> SentimentType:
        result = await build_service(info.context["session"]).get(id)
        return SentimentType(
            id=result.id,
            label=result.label,
            score=result.score,
            product_id=result.product_id,
            created_at=result.created_at.isoformat(),
        )
