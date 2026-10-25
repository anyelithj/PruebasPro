# image_recognition_route.py (FastAPI APIRouter) => rutas del módulo (hoja FastAPI de la matriz).
# Patrón: Chain of Responsibility (guard RBAC -> validación multipart -> controller) + configuración
# declarativa. Roles: SERVICE = Express (búsqueda visual de la tienda); ADMIN = panel de
# administración.

from fastapi import APIRouter, Depends, status

from app.module.image_recognition.controller import image_recognition_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(prefix="/api/v1/ml/image-recognition", tags=["Image Recognition"])
admin_or_service = [Depends(require_roles("ADMIN", "SERVICE"))]
admin_only = [Depends(require_roles("ADMIN"))]

router.add_api_route(
    "/classify",
    controller.classify_image,
    methods=["POST"],
    status_code=status.HTTP_201_CREATED,
    dependencies=admin_or_service,
)
# POST por ser multipart (la imagen viaja en el cuerpo), aunque la operación es una lectura
# (READ_LIST)
router.add_api_route(
    "/search", controller.list_image_search_results, methods=["POST"], dependencies=admin_or_service
)
# RF-06.6 inspección (calidad + moderación) de una foto de producto; antes de "/{embedding_id}"
router.add_api_route(
    "/inspect", controller.inspect_image, methods=["POST"], dependencies=admin_or_service
)
router.add_api_route(
    "/{embedding_id}", controller.get_embedding_by_id, methods=["GET"], dependencies=admin_only
)
router.add_api_route(
    "/{embedding_id}",
    controller.delete_embedding,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=admin_only,
)
