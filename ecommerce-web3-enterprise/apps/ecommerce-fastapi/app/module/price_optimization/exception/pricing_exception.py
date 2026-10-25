# pricing_exception.py (Python) => excepciones de dominio de optimización de precios.
# Patrón: jerarquía de excepciones (AppError). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class PricingDecisionNotFoundError(AppError):
    def __init__(self, decision_id: str) -> None:
        super().__init__(
            404, "PRICING_DECISION_NOT_FOUND", f"Decisión de precio no encontrada: {decision_id}"
        )


class ProductNotPriceableError(AppError):
    def __init__(self, product_id: str) -> None:
        super().__init__(
            404, "PRODUCT_NOT_FOUND", f"Producto activo con precio no encontrado: {product_id}"
        )
