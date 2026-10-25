# ml_prediction_route.py (FastAPI APIRouter) => tabla de rutas del módulo (endpoints de la matriz,
# hoja FastAPI). Patrón: Chain of Responsibility (guard RBAC del router -> validación Pydantic ->
# controller) + configuración declarativa.
# Paradigma: declarativo (cada ruta es un registro: método, path, status, handler).

from fastapi import APIRouter, Depends, status

from app.module.ml_prediction.controller import ml_prediction_controller as controller
from app.shared.middleware.auth_middleware import require_roles

# "dependencies=[...]" a nivel de router => TODAS las rutas exigen JWT con rol ADMIN (los modelos
# son herramienta interna)
router = APIRouter(
    prefix="/api/v1/ml/prediction",
    tags=["ML Predictions"],
    dependencies=[Depends(require_roles("ADMIN"))],
)

# "add_api_route" => registra la ruta sin decorar el handler: el controller queda libre de detalles
# de enrutado
router.add_api_route(
    "", controller.generate_prediction, methods=["POST"], status_code=status.HTTP_201_CREATED
)
router.add_api_route("/{prediction_id}", controller.get_prediction_by_id, methods=["GET"])
router.add_api_route(
    "/{prediction_id}",
    controller.delete_prediction,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)
# ":id" de la matriz = nombre del modelo a entrenar (crea su siguiente versión), p. ej. /demand-
# xgboost/train
router.add_api_route(
    "/{model_name}/train",
    controller.train_model_version,
    methods=["POST"],
    status_code=status.HTTP_202_ACCEPTED,
)
