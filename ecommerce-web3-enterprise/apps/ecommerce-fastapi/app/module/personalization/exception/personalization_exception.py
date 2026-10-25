# personalization_exception.py (Python) => excepciones de dominio del motor de personalización.
# Patrón: jerarquía de excepciones (AppError). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class InteractionNotFoundError(AppError):
    def __init__(self, interaction_id: str) -> None:
        super().__init__(
            404, "INTERACTION_NOT_FOUND", f"Interacción no encontrada: {interaction_id}"
        )
