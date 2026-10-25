# llm_exception.py (Python) => excepciones de dominio del asistente LLM.
# Patrón: jerarquía de excepciones (AppError -> JSON con el contrato de Express). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class ConversationNotFoundError(AppError):
    def __init__(self, conversation_id: str) -> None:
        super().__init__(
            404, "CONVERSATION_NOT_FOUND", f"Conversación no encontrada: {conversation_id}"
        )


class MessageNotFoundError(AppError):
    def __init__(self, message_id: str) -> None:
        super().__init__(404, "MESSAGE_NOT_FOUND", f"Mensaje no encontrado: {message_id}")


class KnowledgeChunkNotFoundError(AppError):
    def __init__(self, chunk_id: str) -> None:
        super().__init__(404, "KNOWLEDGE_CHUNK_NOT_FOUND", f"Fragmento no encontrado: {chunk_id}")


class ToolCallNotFoundError(AppError):
    def __init__(self, tool_call_id: str) -> None:
        super().__init__(404, "TOOL_CALL_NOT_FOUND", f"Invocación no encontrada: {tool_call_id}")


class EvaluationRunNotFoundError(AppError):
    def __init__(self, run_id: str) -> None:
        super().__init__(404, "EVALUATION_NOT_FOUND", f"Evaluación no encontrada: {run_id}")


# LlmProviderError => el proveedor (Ollama) no responde o no tiene el modelo descargado
class LlmProviderError(AppError):
    def __init__(self) -> None:
        super().__init__(503, "LLM_UNAVAILABLE", "El asistente no está disponible en este momento")


# ToolPermissionError => Express rechazó la herramienta con el JWT del usuario (401/403): el
# usuario no tiene permiso sobre ese recurso. Se audita y el LLM recibe "permiso denegado"
class ToolPermissionError(AppError):
    def __init__(self, tool: str) -> None:
        super().__init__(403, "TOOL_FORBIDDEN", f"Sin permiso para la herramienta {tool}")


# GuardrailViolationError => el mensaje trae un secreto que nunca debe salir del navegador
# (frase semilla o clave privada de billetera): no se guarda ni se envía al LLM
class GuardrailViolationError(AppError):
    def __init__(self, reason: str) -> None:
        super().__init__(422, "GUARDRAIL_VIOLATION", reason)
