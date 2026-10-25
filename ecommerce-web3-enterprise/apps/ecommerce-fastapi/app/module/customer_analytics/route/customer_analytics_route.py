# customer_analytics_route.py (FastAPI APIRouter) => rutas de analítica de clientes (matriz).
# Datos personales agregados: solo ADMIN.

from fastapi import APIRouter, Depends, status

from app.module.customer_analytics.controller import customer_analytics_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(
    prefix="/api/v1/ml/customer-analytic",
    tags=["Customer Analytics"],
    dependencies=[Depends(require_roles("ADMIN"))],
)
router.add_api_route(
    "/segment", controller.list_customer_segments, methods=["GET"], response_model=None
)
router.add_api_route("/cache", controller.delete_all_customer_segments, methods=["DELETE"])
router.add_api_route("/ltv/{user_id}", controller.get_ltv_score_by_id, methods=["GET"])
router.add_api_route(
    "/recalculate",
    controller.create_recalculation_job,
    methods=["POST"],
    status_code=status.HTTP_202_ACCEPTED,
)
