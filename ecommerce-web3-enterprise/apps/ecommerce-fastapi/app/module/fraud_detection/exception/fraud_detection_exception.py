# fraud_detection_exception.py (Python) => excepciones de dominio de detección de fraude.
# Patrón: jerarquía de excepciones (AppError). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class AlertNotFoundError(AppError):
    def __init__(self, alert_id: str) -> None:
        super().__init__(
            404, "FRAUD_ALERT_NOT_FOUND", f"Alerta de fraude no encontrada: {alert_id}"
        )


class AlertAlreadyReviewedError(AppError):
    def __init__(self) -> None:
        super().__init__(
            409, "ALERT_ALREADY_REVIEWED", "La alerta ya fue revisada (registro inmutable)"
        )
