# pricing_route.py (FastAPI APIRouter) => rutas de optimización de precios (matriz). Solo ADMIN.
# Rutas fijas (/decision-cache, /batch/optimize) ANTES de las que llevan /{id}.

from fastapi import APIRouter, Depends, status

from app.module.price_optimization.controller import pricing_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(
    prefix="/api/v1/ml/pricing",
    tags=["Price Optimization"],
    dependencies=[Depends(require_roles("ADMIN"))],
)
router.add_api_route("/decision-cache", controller.delete_all_pricing_decisions, methods=["DELETE"])
router.add_api_route(
    "/batch/optimize",
    controller.create_batch_optimization_job,
    methods=["POST"],
    status_code=status.HTTP_202_ACCEPTED,
)
router.add_api_route(
    "/{product_id}/recalculate",
    controller.create_pricing_decision,
    methods=["POST"],
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route(
    "/{product_id}/markdown", controller.create_markdown_plan, methods=["POST"]
)  # RF-18.10
router.add_api_route("/{decision_id}", controller.get_pricing_decision_by_id, methods=["GET"])
