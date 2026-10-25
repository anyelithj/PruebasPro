# ml_prediction_exception.py (Python) => excepciones de dominio del módulo, con su status HTTP y
# código estable. Patrón: jerarquía de excepciones (heredan de AppError; error_middleware las
# traduce a JSON). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


# "class X(AppError)" => herencia; cada subclase fija status y código (el llamador solo aporta el
# contexto)
class ModelNotFoundError(AppError):
    def __init__(self, model_name: str) -> None:
        super().__init__(
            404,
            "MODEL_NOT_FOUND",
            f"No hay una versión entrenada (READY) del modelo '{model_name}'",
        )


class UnknownModelError(AppError):
    def __init__(self, model_name: str) -> None:
        super().__init__(400, "UNKNOWN_MODEL", f"Modelo desconocido: '{model_name}'")


class PredictionNotFoundError(AppError):
    def __init__(self, prediction_id: str) -> None:
        super().__init__(404, "PREDICTION_NOT_FOUND", f"Predicción no encontrada: {prediction_id}")


class PredictionFailedError(AppError):
    def __init__(self, reason: str) -> None:
        # 422: la petición es válida pero no hay datos suficientes
        super().__init__(422, "PREDICTION_FAILED", reason)
