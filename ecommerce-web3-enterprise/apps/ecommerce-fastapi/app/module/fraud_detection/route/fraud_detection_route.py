# fraud_detection_route.py (FastAPI APIRouter) => rutas de detección de fraude (matriz).
# SERVICE = Express (analiza cada pago); las alertas y su revisión son solo para ADMIN.

from fastapi import APIRouter, Depends, status

from app.module.fraud_detection.controller import fraud_detection_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(prefix="/api/v1/ml/fraud", tags=["Fraud Detection"])
admin = [Depends(require_roles("ADMIN"))]

router.add_api_route(
    "/analyze",
    controller.create_fraud_analysis,
    methods=["POST"],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("ADMIN", "SERVICE"))],
)
router.add_api_route("/alert", controller.list_fraud_alerts, methods=["GET"], dependencies=admin)
router.add_api_route(
    "/alert/{alert_id}", controller.get_fraud_alert_by_id, methods=["GET"], dependencies=admin
)
router.add_api_route(
    "/alert/{alert_id}/dismiss",
    controller.update_alert_dismissal,
    methods=["PATCH"],
    dependencies=admin,
)
