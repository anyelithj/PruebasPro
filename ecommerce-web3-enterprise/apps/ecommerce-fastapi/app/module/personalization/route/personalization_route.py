# personalization_route.py (FastAPI APIRouter) => rutas del motor de personalización (matriz).
# Clientes: sus propias recomendaciones e interacciones (ensure_owner en el service).
# Reentrenar: solo ADMIN. Rutas fijas ANTES de /{user_id}.

from fastapi import APIRouter, Depends, status

from app.module.personalization.controller import personalization_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(prefix="/api/v1/ml/personalization", tags=["Personalization"])
router.add_api_route(
    "/feedback",
    controller.create_interaction_record,
    methods=["POST"],
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route(
    "/model/train",
    controller.create_personalization_model,
    methods=["POST"],
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_roles("ADMIN"))],
)
router.add_api_route(
    "/interaction/{interaction_id}",
    controller.delete_interaction_record_by_id,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)
router.add_api_route("/{user_id}", controller.get_personalization_profile_by_id, methods=["GET"])
