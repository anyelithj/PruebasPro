# forecasting_controller.py (FastAPI + Strawberry GraphQL) => traduce HTTP/GraphQL <-> casos de uso
# del pronóstico de demanda. Sin lógica de negocio (SRP): REST y GraphQL comparten el service (DRY).
# Patrón: Controller + inyección de dependencias (Depends) + Adapter (tipo GraphQL sobre el DTO).
# Paradigma: asíncrono (async def) + funcional (handlers sin estado).

from typing import Annotated

import strawberry
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON

from app.config.database_config import get_session
from app.module.demand_forecasting.repository.forecasting_repository import ForecastingRepository
from app.module.demand_forecasting.schema.forecasting_schema import (
    ForecastModelJobResponse,
    ForecastRequest,
    ForecastResponse,
    SimulationRequest,
    SimulationResponse,
)
from app.module.demand_forecasting.service.forecasting_service import ForecastingService
from app.module.ml_prediction.controller.ml_prediction_controller import (
    build_service as build_prediction_service,
)
from app.shared.types.common_types import ApiResponse


# build_service => Factory por request: una AsyncSession compartida (una Unit of Work)
def build_service(session: AsyncSession) -> ForecastingService:
    return ForecastingService(ForecastingRepository(session), build_prediction_service(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> ForecastingService:
    return build_service(session)


Service = Annotated[ForecastingService, Depends(get_service)]  # Alias de tipo (DRY)


# createForecastResult() — POST /
async def create_forecast_result(
    body: ForecastRequest, service: Service
) -> ApiResponse[ForecastResponse]:
    result = await service.create_forecast(body.product_id, body.horizon_days, body.granularity)
    return ApiResponse(data=ForecastResponse.model_validate(result))


# getForecastResultById() — GET /:id
async def get_forecast_result_by_id(
    forecast_id: str, service: Service
) -> ApiResponse[ForecastResponse]:
    return ApiResponse(data=ForecastResponse.model_validate(await service.get(forecast_id)))


# deleteForecastResultById() — DELETE /:id => 204 sin cuerpo
async def delete_forecast_result_by_id(forecast_id: str, service: Service) -> None:
    await service.delete(forecast_id)


# createForecastModel() — POST /model => 202 Accepted + { job_id, status: QUEUED }
async def create_forecast_model(service: Service) -> ApiResponse[ForecastModelJobResponse]:
    model, job_id = await service.enqueue_model()
    return ApiResponse(
        data=ForecastModelJobResponse(
            job_id=job_id, status=model.status, forecast_model_id=model.id, version=model.version
        )
    )


# createSimulation() — POST /simulate (RF-24.14 impacto de promociones y eventos)
async def create_simulation(
    body: SimulationRequest, service: Service
) -> ApiResponse[SimulationResponse]:
    result = await service.simulate(
        body.product_id, body.discount, body.event, body.start, body.promo_days, body.horizon_days
    )
    return ApiResponse(data=SimulationResponse(**result))


# --- GraphQL (Strawberry) — lectura por ID sobre el mismo service ---
@strawberry.type
class ForecastType:
    id: str
    forecast_model_id: str
    product_id: str
    horizon_days: int
    granularity: str
    forecast: JSON
    seasonality: JSON
    cold_start: bool
    created_at: str


@strawberry.type
class ForecastingQuery:
    @strawberry.field
    async def forecast_result(self, info: strawberry.Info, id: str) -> ForecastType:
        result = await build_service(info.context["session"]).get(id)
        # "mode=json" => fechas como texto ISO
        return ForecastType(**ForecastResponse.model_validate(result).model_dump(mode="json"))
