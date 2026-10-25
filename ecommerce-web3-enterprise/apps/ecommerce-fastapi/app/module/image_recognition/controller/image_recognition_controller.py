# image_recognition_controller.py (FastAPI + Strawberry GraphQL) => traduce HTTP/GraphQL <-> casos
# de uso del módulo de visión. Sin lógica de negocio (SRP).
# Patrón: Controller + inyección de dependencias (Depends) + Adapter (tipos GraphQL sobre los DTO).
# Paradigma: asíncrono + declarativo (UploadFile/Form/Field describen y validan la entrada).

import json
from typing import Annotated

import strawberry  # Strawberry: GraphQL "code-first" con type hints de Python
from fastapi import Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON  # Escalar JSON: listas/dicts sin declarar un tipo por campo

from app.config.database_config import get_session
from app.module.image_recognition.exception.image_recognition_exception import (
    ImageTooLargeError,
    InvalidImageError,
)
from app.module.image_recognition.repository.image_recognition_repository import (
    ImageRecognitionRepository,
)
from app.module.image_recognition.schema.image_recognition_schema import (
    ClassifyResponse,
    InspectResponse,
    SearchItem,
    SearchResponse,
    VisualAttributes,
)
from app.module.image_recognition.service.image_recognition_service import ImageRecognitionService
from app.shared.constants.ml_constants import MAX_IMAGE_BYTES, MAX_SEARCH_RESULTS
from app.shared.types.common_types import ApiResponse


def build_service(session: AsyncSession) -> ImageRecognitionService:
    return ImageRecognitionService(ImageRecognitionRepository(session))


# Factory por request (REST): misma AsyncSession para repositorio y service (Unit of Work)
def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> ImageRecognitionService:
    return build_service(session)


Service = Annotated[ImageRecognitionService, Depends(get_service)]  # Alias de tipo (DRY)


# _read => lee como máximo MAX_IMAGE_BYTES + 1: nunca carga en memoria un archivo gigante entero
async def _read(file: UploadFile) -> bytes:
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageTooLargeError()
    return data


# classifyImage() — POST /classify (multipart/form-data: file + product_id opcional)
async def classify_image(
    service: Service,
    file: Annotated[UploadFile, File()],
    product_id: Annotated[str | None, Form(max_length=36)] = None,
) -> ApiResponse[ClassifyResponse]:
    entity = await service.classify_image(await _read(file), file.filename or "image", product_id)
    return ApiResponse(data=ClassifyResponse.model_validate(entity))


MAX_BRAND_CANDIDATES = 50  # Marcas candidatas de logo por búsqueda (costo lineal en CLIP)


# _brands => RF-06.4 lista JSON de nombres de marca enviada por Express (texto no confiable: se
# valida la forma, el largo y la cantidad)
def _brands(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    try:
        names = json.loads(raw)
    except json.JSONDecodeError as error:
        raise InvalidImageError("brands debe ser una lista JSON") from error
    if not isinstance(names, list):
        raise InvalidImageError("brands debe ser una lista JSON")
    clean = [name.strip()[:60] for name in names if isinstance(name, str) and name.strip()]
    return tuple(clean[:MAX_BRAND_CANDIDATES])


# listImageSearchResults() — POST /search (multipart/form-data: file + k + brands opcional)
async def list_image_search_results(
    service: Service,
    file: Annotated[UploadFile, File()],
    k: Annotated[int, Form(ge=1, le=MAX_SEARCH_RESULTS)] = 12,
    brands: Annotated[str | None, Form(max_length=5000)] = None,
) -> ApiResponse[SearchResponse]:
    rows, attributes = await service.search(await _read(file), k, _brands(brands))
    items = [
        SearchItem(
            embedding_id=row["id"],
            product_id=row["product_id"],
            similarity=row["similarity"],
            labels=row["labels"],
        )
        for row in rows
    ]
    return ApiResponse(
        data=SearchResponse(items=items, attributes=VisualAttributes.model_validate(attributes))
    )


# inspectImage() — POST /inspect (RF-06.6): calidad + moderación antes de publicar una foto
async def inspect_image(
    service: Service, file: Annotated[UploadFile, File()]
) -> ApiResponse[InspectResponse]:
    return ApiResponse(
        data=InspectResponse.model_validate(await service.inspect(await _read(file)))
    )


# getEmbeddingById() — GET /:id
async def get_embedding_by_id(embedding_id: str, service: Service) -> ApiResponse[ClassifyResponse]:
    return ApiResponse(
        data=ClassifyResponse.model_validate(await service.get_embedding(embedding_id))
    )


# deleteEmbedding() — DELETE /:id => 204
async def delete_embedding(embedding_id: str, service: Service) -> None:
    await service.delete_embedding(embedding_id)


# --- GraphQL (Strawberry) — lectura por ID; la subida de archivos queda en REST (multipart) ---
@strawberry.type
class ImageEmbeddingType:
    id: str
    product_id: str | None
    filename: str
    labels: JSON
    # ISO 8601 (el vector de 512 floats no se expone por GraphQL: respuesta liviana)
    created_at: str


@strawberry.type
class ImageRecognitionQuery:
    @strawberry.field
    async def image_embedding(self, info: strawberry.Info, id: str) -> ImageEmbeddingType:
        entity = await build_service(info.context["session"]).get_embedding(id)
        return ImageEmbeddingType(
            id=entity.id,
            product_id=entity.product_id,
            filename=entity.filename,
            labels=entity.labels,
            created_at=entity.created_at.isoformat(),
        )
