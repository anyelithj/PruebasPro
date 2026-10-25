# customer_analytics_controller.py (FastAPI + Strawberry) => traduce HTTP/GraphQL <-> casos de uso
# de analítica de clientes. Exportación CSV con el módulo "csv" de la biblioteca estándar.
# Patrón: Controller + DI + Adapter (GraphQL). Paradigma: asíncrono.

import csv
import io
from typing import Annotated, Literal

import strawberry
from fastapi import Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database_config import get_session
from app.module.customer_analytics.repository.customer_analytics_repository import (
    CustomerAnalyticsRepository,
)
from app.module.customer_analytics.schema.customer_analytics_schema import (
    JobResponse,
    LTVResponse,
    SegmentResponse,
)
from app.module.customer_analytics.service.customer_analytics_service import (
    CustomerAnalyticsService,
)
from app.shared.types.common_types import ApiResponse
from app.shared.util.pagination_util import Page


def build_service(session: AsyncSession) -> CustomerAnalyticsService:
    return CustomerAnalyticsService(CustomerAnalyticsRepository(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> CustomerAnalyticsService:
    return build_service(session)


Service = Annotated[CustomerAnalyticsService, Depends(get_service)]


# listCustomerSegments() — GET /segment?segment=&cluster=&format=json|csv (CSV = exportación)
async def list_customer_segments(
    service: Service,
    params: Page,
    segment: Annotated[str | None, Query(max_length=16)] = None,
    cluster: Annotated[int | None, Query(ge=0)] = None,
    format: Annotated[Literal["json", "csv"], Query()] = "json",
) -> ApiResponse[list[SegmentResponse]] | Response:
    if format == "csv":
        rows = [
            SegmentResponse.model_validate(r).model_dump(mode="json")
            for r in await service.export_segments(segment, cluster)
        ]
        buffer = io.StringIO()  # Archivo en memoria (sin tocar el disco)
        writer = csv.DictWriter(buffer, fieldnames=list(SegmentResponse.model_fields))
        writer.writeheader()
        writer.writerows(rows)
        return Response(
            buffer.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="customer-segments.csv"'},
        )
    items, meta = await service.list_segments(segment, cluster, params)
    return ApiResponse(data=[SegmentResponse.model_validate(item) for item in items], meta=meta)


# getLTVScoreById() — GET /ltv/:id (id = cliente)
async def get_ltv_score_by_id(user_id: str, service: Service) -> ApiResponse[LTVResponse]:
    return ApiResponse(data=LTVResponse.model_validate(await service.get_ltv(user_id)))


# createRecalculationJob() — POST /recalculate => 202 + { job_id, status: QUEUED }
async def create_recalculation_job(service: Service) -> ApiResponse[JobResponse]:
    job = await service.enqueue_recalculation()
    return ApiResponse(data=JobResponse(job_id=job.id, status=job.status))


# deleteAllCustomerSegments() — DELETE /cache
async def delete_all_customer_segments(service: Service) -> ApiResponse[dict[str, int]]:
    return ApiResponse(data={"deleted": await service.clear_cache()})


# --- GraphQL ---
@strawberry.type
class LtvType:
    user_id: str
    ltv_cents: int
    horizon_days: int
    method: str


@strawberry.type
class CustomerAnalyticsQuery:
    @strawberry.field
    async def ltv_score(self, info: strawberry.Info, user_id: str) -> LtvType:
        score = await build_service(info.context["session"]).get_ltv(user_id)
        return LtvType(
            user_id=score.user_id,
            ltv_cents=score.ltv_cents,
            horizon_days=score.horizon_days,
            method=score.method,
        )
