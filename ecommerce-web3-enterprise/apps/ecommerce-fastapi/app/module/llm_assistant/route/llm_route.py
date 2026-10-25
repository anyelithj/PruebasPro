# llm_route.py (FastAPI APIRouter) => rutas del asistente LLM (hoja FastAPI de la matriz, filas
# 147–176: 19 endpoints). Cualquier usuario autenticado chatea (el service verifica la propiedad de
# cada conversación); conocimiento, auditoría de herramientas y evaluaciones exigen rol ADMIN
# (indexar también SERVICE: Express re-indexa al crear/editar productos).
# Patrón: Chain of Responsibility (guard JWT/RBAC -> rate limit -> validación Pydantic ->
# controller) + Registry (tabla de rutas como datos). Paradigma: declarativo.

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse

from app.config.llm_config import get_llm_settings
from app.module.llm_assistant.controller import llm_controller as controller
from app.shared.middleware.auth_middleware import require_roles
from app.shared.middleware.rate_limit_middleware import rate_limit

router = APIRouter(prefix="/api/v1/ml/llm", tags=["LLM Assistant"])
admin = [Depends(require_roles("ADMIN"))]
created, accepted, empty = (
    status.HTTP_201_CREATED,
    status.HTTP_202_ACCEPTED,
    status.HTTP_204_NO_CONTENT,
)
CONVERSATION = "/conversations/{conversation_id}"
MESSAGE = CONVERSATION + "/messages/{message_id}"

# (ruta, handler, método, extras) => una línea por endpoint de la matriz (OCP: agregar = 1 fila)
ROUTES = [
    ("/conversations", controller.create_llm_conversation, "POST", {"status_code": created}),
    ("/conversations", controller.list_llm_conversations, "GET", {}),
    (CONVERSATION, controller.get_llm_conversation_by_id, "GET", {}),
    (CONVERSATION, controller.delete_llm_conversation_by_id, "DELETE", {"status_code": empty}),
    (
        CONVERSATION + "/messages",
        controller.create_llm_message,
        "POST",
        {
            "response_class": StreamingResponse,  # OpenAPI: text/event-stream, no JSON
            # Límite por usuario y minuto: cada mensaje ocupa el modelo local (CPU/GPU)
            "dependencies": [
                Depends(rate_limit("llm", get_llm_settings().LLM_RATE_LIMIT_PER_MINUTE))
            ],
        },
    ),
    (CONVERSATION + "/messages", controller.list_llm_messages, "GET", {}),
    (MESSAGE, controller.get_llm_message_by_id, "GET", {}),
    (MESSAGE, controller.update_llm_message_feedback, "PATCH", {}),
    (
        "/knowledge/index",
        controller.create_knowledge_index_job,
        "POST",
        {"status_code": accepted, "dependencies": [Depends(require_roles("ADMIN", "SERVICE"))]},
    ),
    ("/knowledge", controller.list_knowledge_chunks, "GET", {"dependencies": admin}),
    ("/knowledge/{chunk_id}", controller.get_knowledge_chunk_by_id, "GET", {"dependencies": admin}),
    (
        "/knowledge/{chunk_id}",
        controller.delete_knowledge_chunk_by_id,
        "DELETE",
        {"status_code": empty, "dependencies": admin},
    ),
    ("/knowledge", controller.delete_all_knowledge_chunks, "DELETE", {"dependencies": admin}),
    ("/tool-calls", controller.list_llm_tool_calls, "GET", {"dependencies": admin}),
    (
        "/tool-calls/{tool_call_id}",
        controller.get_llm_tool_call_by_id,
        "GET",
        {"dependencies": admin},
    ),
    (
        "/evaluations",
        controller.create_llm_evaluation_run,
        "POST",
        {"status_code": accepted, "dependencies": admin},
    ),
    ("/evaluations", controller.list_llm_evaluation_runs, "GET", {"dependencies": admin}),
    (
        "/evaluations/{run_id}",
        controller.get_llm_evaluation_run_by_id,
        "GET",
        {"dependencies": admin},
    ),
    (
        "/evaluations/{run_id}",
        controller.delete_llm_evaluation_run_by_id,
        "DELETE",
        {"status_code": empty, "dependencies": admin},
    ),
]

for path, handler, method, extra in ROUTES:
    router.add_api_route(path, handler, methods=[method], **extra)
