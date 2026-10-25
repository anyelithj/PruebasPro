# pricing_controller.py (FastAPI + Strawberry) => traduce HTTP/GraphQL <-> casos de uso de precios.
# Patrón: Controller + DI + Adapter (GraphQL). Paradigma: asíncrono.

from typing import Annotated

import strawberry
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON

from app.config.database_config import get_session
from app.module.price_optimization.repository.pricing_repository import PricingRepository
from app.module.price_optimization.schema.pricing_schema import (
    BatchJobResponse,
    BatchRequest,
    DecisionResponse,
    MarkdownRequest,
    MarkdownResponse,
    RecalculateRequest,
)
from app.module.price_optimization.service.pricing_service import PricingService
from app.shared.types.common_types import ApiResponse


def build_service(session: AsyncSession) -> PricingService:
    return PricingService(PricingRepository(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> PricingService:
    return build_service(session)


Service = Annotated[PricingService, Depends(get_service)]


# createPricingDecision() — POST /:id/recalculate (id = producto)
async def create_pricing_decision(
    product_id: str, body: RecalculateRequest, service: Service
) -> ApiResponse[DecisionResponse]:
    decision = await service.recalculate(product_id, body.strategy, body.competitor_prices)
    return ApiResponse(data=DecisionResponse.model_validate(decision))


# createMarkdownPlan() — POST /:id/markdown (RF-18.10 calendario de rebajas)
async def create_markdown_plan(
    product_id: str, body: MarkdownRequest, service: Service
) -> ApiResponse[MarkdownResponse]:
    plan = await service.markdown(
        product_id,
        body.weeks,
        body.revenue_weight,
        body.unit_cost_cents,
        body.salvage_rate,
        body.stock,
    )
    return ApiResponse(data=MarkdownResponse(**plan))


# getPricingDecisionById() — GET /:id
async def get_pricing_decision_by_id(
    decision_id: str, service: Service
) -> ApiResponse[DecisionResponse]:
    return ApiResponse(data=DecisionResponse.model_validate(await service.get(decision_id)))


# deleteAllPricingDecisions() — DELETE /decision-cache
async def delete_all_pricing_decisions(service: Service) -> ApiResponse[dict[str, int]]:
    return ApiResponse(data={"deleted": await service.clear_cache()})


# createBatchOptimizationJob() — POST /batch/optimize => 202 + { job_id }
async def create_batch_optimization_job(
    body: BatchRequest, service: Service
) -> ApiResponse[BatchJobResponse]:
    job = await service.enqueue_batch(body.product_ids, body.strategy)
    return ApiResponse(data=BatchJobResponse(job_id=job.id, status=job.status))


# --- GraphQL ---
@strawberry.type
class PricingDecisionType:
    id: str
    product_id: str
    current_price_cents: int
    recommended_price_cents: int
    strategy: str
    explanation: JSON


@strawberry.type
class PricingQuery:
    @strawberry.field
    async def pricing_decision(self, info: strawberry.Info, id: str) -> PricingDecisionType:
        d = await build_service(info.context["session"]).get(id)
        return PricingDecisionType(
            id=d.id,
            product_id=d.product_id,
            current_price_cents=d.current_price_cents,
            recommended_price_cents=d.recommended_price_cents,
            strategy=d.strategy,
            explanation=d.explanation,
        )
