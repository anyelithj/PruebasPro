# forecasting_route.py (FastAPI APIRouter) => rutas del pronóstico de demanda (hoja FastAPI).
# Patrón: Chain of Responsibility (guard RBAC -> validación Pydantic -> controller).
# Paradigma: declarativo. SERVICE = Express (reabastecimiento de inventario); ADMIN = panel.
# "/model" se declara antes de "/{forecast_id}" para que no lo capture el parámetro.

from fastapi import APIRouter, Depends, status

from app.module.demand_forecasting.controller import forecasting_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(
    prefix="/api/v1/ml/forecasting",
    tags=["Demand Forecasting"],
    dependencies=[Depends(require_roles("ADMIN", "SERVICE"))],
)
router.add_api_route(
    "", controller.create_forecast_result, methods=["POST"], status_code=status.HTTP_201_CREATED
)
router.add_api_route(
    "/model",
    controller.create_forecast_model,
    methods=["POST"],
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_roles("ADMIN"))],  # Entrenar es tarea interna del panel
)
router.add_api_route("/simulate", controller.create_simulation, methods=["POST"])  # RF-24.14
router.add_api_route("/{forecast_id}", controller.get_forecast_result_by_id, methods=["GET"])
router.add_api_route(
    "/{forecast_id}",
    controller.delete_forecast_result_by_id,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)
