# customer_analytics_exception.py (Python) => excepciones de dominio de analítica de clientes.
# Patrón: jerarquía de excepciones (AppError). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class LtvNotFoundError(AppError):
    def __init__(self, user_id: str) -> None:
        super().__init__(
            404,
            "LTV_NOT_FOUND",
            f"Sin LTV calculado para el cliente {user_id}: ejecuta /recalculate",
        )
