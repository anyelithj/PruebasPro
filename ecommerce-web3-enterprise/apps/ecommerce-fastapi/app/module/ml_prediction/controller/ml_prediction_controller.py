# ml_prediction_controller.py (FastAPI + Pydantic + Strawberry GraphQL) => traduce HTTP/GraphQL <->
# casos de uso: recibe DTO validados, llama al service y devuelve { success, data }. Sin lógica de
# negocio (SRP): REST y GraphQL comparten el MISMO service (DRY).
# Patrón: Controller + inyección de dependencias (Depends) + Adapter (tipos GraphQL sobre los DTO).
# Paradigma: asíncrono (async def) + funcional (handlers sin estado).

# Annotated[T, Depends(...)] => tipo + metadato de inyección de FastAPI
from typing import Annotated

import strawberry  # Strawberry: GraphQL "code-first" con type hints de Python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON  # Escalar JSON para forecast/explanation (estructuras anidadas)

from app.config.database_config import get_session
from app.module.ml_prediction.repository.ml_prediction_repository import MLPredictionRepository
from app.module.ml_prediction.schema.ml_prediction_schema import (
    PredictionRequest,
    PredictionResponse,
    TrainJobResponse,
)
from app.module.ml_prediction.service.ml_prediction_service import MLPredictionService
from app.shared.types.common_types import ApiResponse


# get_service => Factory por request: misma AsyncSession para repositorio y service (una Unit of
# Work por petición)
def build_service(session: AsyncSession) -> MLPredictionService:
    return MLPredictionService(MLPredictionRepository(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> MLPredictionService:
    return build_service(session)


# Alias de tipo (DRY): cada handler declara "service: Service" en lugar de repetir
# Depends(get_service)
Service = Annotated[MLPredictionService, Depends(get_service)]


# generatePrediction() de la matriz
async def generate_prediction(
    body: PredictionRequest, service: Service
) -> ApiResponse[PredictionResponse]:
    prediction = await service.generate_prediction(
        body.product_id, body.horizon_days, body.model_name
    )
    # "model_validate" (Pydantic v2) => entidad SQLAlchemy -> DTO (from_attributes)
    return ApiResponse(data=PredictionResponse.model_validate(prediction))


# getPredictionById()
async def get_prediction_by_id(
    prediction_id: str, service: Service
) -> ApiResponse[PredictionResponse]:
    return ApiResponse(
        data=PredictionResponse.model_validate(await service.get_prediction(prediction_id))
    )


# deletePrediction() => 204 sin cuerpo
async def delete_prediction(prediction_id: str, service: Service) -> None:
    await service.delete_prediction(prediction_id)


# trainModelVersion() => 202 Accepted + { job_id, status: QUEUED }
async def train_model_version(model_name: str, service: Service) -> ApiResponse[TrainJobResponse]:
    version, job_id = await service.enqueue_training(model_name)
    return ApiResponse(
        data=TrainJobResponse(
            job_id=job_id,
            status=version.status,
            model_version_id=version.id,
            version=version.version,
        )
    )


# --- GraphQL (Strawberry) — mismas operaciones que REST, sobre el mismo service ---
@strawberry.type
class PredictionType:
    id: str
    model_version_id: str
    product_id: str
    horizon_days: int
    forecast: JSON
    variant: str
    explanation: JSON | None
    cold_start: bool
    created_at: str

    # "@staticmethod" => constructor alternativo (Factory) desde el DTO validado
    @staticmethod
    def from_dto(dto: PredictionResponse) -> "PredictionType":
        return PredictionType(**dto.model_dump(mode="json"))  # "mode=json" => fechas como texto ISO


@strawberry.type
class PredictionQuery:
    @strawberry.field
    async def prediction_result(self, info: strawberry.Info, id: str) -> PredictionType:
        prediction = await build_service(info.context["session"]).get_prediction(id)
        return PredictionType.from_dto(PredictionResponse.model_validate(prediction))


@strawberry.type
class PredictionMutation:
    @strawberry.mutation
    async def generate_prediction(
        self,
        info: strawberry.Info,
        product_id: str,
        horizon_days: int = 14,
        model_name: str = "demand-xgboost",
    ) -> PredictionType:
        # Reutiliza PredictionRequest: mismas reglas de validación que REST (1-90 días)
        body = PredictionRequest(
            product_id=product_id, horizon_days=horizon_days, model_name=model_name
        )
        service = build_service(info.context["session"])
        prediction = await service.generate_prediction(
            body.product_id, body.horizon_days, body.model_name
        )
        return PredictionType.from_dto(PredictionResponse.model_validate(prediction))
