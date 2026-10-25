# nlp_exception.py (Python) => excepciones de dominio del módulo de lenguaje natural.
# Patrón: jerarquía de excepciones (AppError). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class ChatSessionNotFoundError(AppError):
    def __init__(self, session_id: str) -> None:
        super().__init__(
            404, "CHAT_SESSION_NOT_FOUND", f"Sesión de chat no encontrada: {session_id}"
        )


class TrainingExampleNotFoundError(AppError):
    def __init__(self, example_id: str) -> None:
        super().__init__(404, "TRAINING_EXAMPLE_NOT_FOUND", f"Ejemplo no encontrado: {example_id}")
