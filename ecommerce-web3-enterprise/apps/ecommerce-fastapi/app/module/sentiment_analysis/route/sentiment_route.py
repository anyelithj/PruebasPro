# sentiment_route.py (FastAPI APIRouter) => rutas del módulo (hoja FastAPI de la matriz).
# Patrón: Chain of Responsibility (guard RBAC -> validación -> controller). Las rutas fijas
# (/aggregate, /analysis-cache) se declaran ANTES de /{result_id} (indicación de la matriz).
# SERVICE = Express (analiza reseñas al publicarse); ADMIN = panel.

from fastapi import APIRouter, Depends, status

from app.module.sentiment_analysis.controller import sentiment_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(
    prefix="/api/v1/ml/sentiment",
    tags=["Sentiment Analysis"],
    dependencies=[Depends(require_roles("ADMIN", "SERVICE"))],
)
router.add_api_route(
    "/analyze",
    controller.create_sentiment_result,
    methods=["POST"],
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route("/aggregate", controller.list_sentiment_aggregates, methods=["GET"])
# RF-15.11 sentimiento + causas de lo negativo en comentarios de redes (antes de /{result_id})
router.add_api_route("/insights", controller.create_social_insights, methods=["POST"])
router.add_api_route("/analysis-cache", controller.delete_all_sentiment_results, methods=["DELETE"])
router.add_api_route("/{result_id}", controller.get_sentiment_result_by_id, methods=["GET"])
