# tool_executor.py (httpx async) => ejecuta las herramientas que pide el LLM contra la API REST de
# Express (Plan 5B.3) reenviando el JWT del usuario: Express aplica sus propias reglas (un cliente
# solo ve SUS pedidos), así el asistente nunca tiene más permisos que la persona que chatea.
# Los argumentos que genera el modelo son entrada NO confiable: se validan con Pydantic antes de
# llamar. Cada invocación queda auditada en LlmToolCall (también las rechazadas o denegadas).
# Patrón: Guard (validación + permisos antes de ejecutar) + Adapter (herramienta -> HTTP GET) +
# Singleton (un cliente HTTP con pool de conexiones por proceso). Paradigma: asíncrono + POO.

import json
import time
from functools import lru_cache
from typing import Any

import httpx
from pydantic import ValidationError

from app.config.llm_config import get_llm_settings
from app.module.llm_assistant.exception.llm_exception import ToolPermissionError
from app.module.llm_assistant.ml.llm_provider import ToolRequest
from app.module.llm_assistant.ml.tool_registry import TOOLS
from app.module.llm_assistant.model.llm_model import LlmToolCall
from app.shared.constants.ml_constants import MAX_TOOL_RESULT_CHARS
from app.shared.middleware.auth_middleware import AuthUser


# get_http_client => Singleton perezoso: keep-alive reutiliza conexiones TCP con Express
@lru_cache(maxsize=1)
def get_http_client() -> httpx.AsyncClient:
    settings = get_llm_settings()
    return httpx.AsyncClient(
        base_url=settings.EXPRESS_API_URL, timeout=settings.TOOL_TIMEOUT_SECONDS
    )


class ToolExecutor:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client  # Inyectado (DIP): las pruebas usan httpx.MockTransport

    # execute => (texto JSON para el LLM, registro de auditoría sin guardar)
    async def execute(
        self, user: AuthUser, conversation_id: str, request: ToolRequest
    ) -> tuple[str, LlmToolCall]:
        started = time.perf_counter()
        arguments: dict[str, Any] = request.arguments
        status, http_status, result = "ok", None, None
        try:
            if (tool := TOOLS.get(request.name)) is None:
                raise LookupError(request.name)
            args = tool.args.model_validate(request.arguments)
            arguments = args.model_dump(mode="json")  # Lo validado es lo que se audita
            path, params = tool.path(args)
            response = await self.client.get(
                path, params=params, headers={"Authorization": f"Bearer {user.token}"}
            )
            http_status = response.status_code
            if http_status in (401, 403):
                raise ToolPermissionError(tool.name)
            if http_status == 404:
                status, result = "not_found", {"error": "no encontrado"}
            else:
                response.raise_for_status()
                result = tool.summarize(response.json()["data"])  # Sobre { success, data }
        except (LookupError, ValidationError):  # Herramienta inexistente o argumentos inválidos
            status, result = "rejected", {"error": "herramienta o argumentos inválidos"}
        except ToolPermissionError:
            status, result = "denied", {"error": "permiso denegado para este usuario"}
        except (httpx.HTTPError, ValueError, KeyError):  # Express caído, 5xx o JSON inesperado
            status, result = "error", {"error": "servicio no disponible"}
        audit = LlmToolCall(
            conversation_id=conversation_id,
            user_id=user.id,
            tool=request.name[:40],
            arguments=arguments,
            status=status,
            http_status=http_status,
            result=result,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        return json.dumps(result, ensure_ascii=False, default=str)[:MAX_TOOL_RESULT_CHARS], audit
