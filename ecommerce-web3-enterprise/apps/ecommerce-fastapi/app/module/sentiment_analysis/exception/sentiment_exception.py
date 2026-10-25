# sentiment_exception.py (Python) => excepciones de dominio del módulo de sentimiento.
# Patrón: jerarquía de excepciones (AppError). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class SentimentNotFoundError(AppError):
    def __init__(self, result_id: str) -> None:
        super().__init__(
            404, "SENTIMENT_NOT_FOUND", f"Análisis de sentimiento no encontrado: {result_id}"
        )
