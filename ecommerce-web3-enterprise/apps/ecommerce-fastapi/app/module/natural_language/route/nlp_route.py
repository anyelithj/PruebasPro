# nlp_route.py (FastAPI APIRouter) => rutas del chatbot y del análisis de intención (matriz).
# Cualquier usuario autenticado (cliente incluido) puede chatear; cada handler exige CurrentUser y
# el service verifica que la sesión sea suya (ensure_owner).

from fastapi import APIRouter, Depends, status

from app.module.natural_language.controller import nlp_controller as controller
from app.shared.middleware.auth_middleware import require_roles

router = APIRouter(prefix="/api/v1/ml/nlp", tags=["Natural Language"])
router.add_api_route(
    "/intent", controller.create_nlp_result, methods=["POST"], status_code=status.HTTP_201_CREATED
)
router.add_api_route(
    "/message",
    controller.create_llm_response,
    methods=["POST"],
    status_code=status.HTTP_201_CREATED,
)
router.add_api_route("/session/{session_id}", controller.get_chat_session_by_id, methods=["GET"])
router.add_api_route(
    "/session/{session_id}",
    controller.delete_chat_session_by_id,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)

# RF-17.12 / RF-17.13 entrenamiento y métricas: solo el panel (ADMIN) o Express (SERVICE)
training_router = APIRouter(
    prefix="/api/v1/ml/nlp",
    tags=["Natural Language"],
    dependencies=[Depends(require_roles("ADMIN", "SERVICE"))],
)
training_router.add_api_route("/training", controller.list_training, methods=["GET"])
training_router.add_api_route(
    "/training", controller.create_training, methods=["POST"], status_code=status.HTTP_201_CREATED
)
training_router.add_api_route(
    "/training/{example_id}", controller.update_training, methods=["PATCH"]
)
training_router.add_api_route(
    "/training/{example_id}",
    controller.delete_training,
    methods=["DELETE"],
    status_code=status.HTTP_204_NO_CONTENT,
)
training_router.add_api_route("/metrics", controller.get_nlu_metrics, methods=["GET"])
