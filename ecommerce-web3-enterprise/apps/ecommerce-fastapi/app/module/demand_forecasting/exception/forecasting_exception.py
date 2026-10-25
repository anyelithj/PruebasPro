# forecasting_exception.py (Python) => excepciones de dominio del pronóstico de demanda.
# Patrón: jerarquía de excepciones (AppError; error_middleware las traduce a JSON). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class ForecastNotFoundError(AppError):
    def __init__(self, forecast_id: str) -> None:
        super().__init__(404, "FORECAST_NOT_FOUND", f"Pronóstico no encontrado: {forecast_id}")


class ForecastModelNotFoundError(AppError):
    def __init__(self) -> None:
        super().__init__(
            404,
            "FORECAST_MODEL_NOT_FOUND",
            "No hay una versión entrenada (READY) del modelo de pronóstico: POST /model primero",
        )


class ForecastFailedError(AppError):
    def __init__(self, reason: str) -> None:
        super().__init__(422, "FORECAST_FAILED", reason)  # Petición válida, datos insuficientes
