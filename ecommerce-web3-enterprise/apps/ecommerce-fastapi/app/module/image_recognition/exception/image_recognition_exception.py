# image_recognition_exception.py (Python) => excepciones de dominio del módulo de visión.
# Patrón: jerarquía de excepciones (heredan de AppError; error_middleware las traduce a JSON).
# Paradigma: POO.

from app.shared.constants.ml_constants import MAX_IMAGE_BYTES
from app.shared.middleware.error_middleware import AppError


class InvalidImageError(AppError):
    def __init__(self, reason: str) -> None:
        super().__init__(422, "INVALID_IMAGE", reason)


class ImageTooLargeError(AppError):
    def __init__(self) -> None:
        super().__init__(
            413, "IMAGE_TOO_LARGE", f"La imagen supera {MAX_IMAGE_BYTES // (1024 * 1024)} MB"
        )


class EmbeddingNotFoundError(AppError):
    def __init__(self, embedding_id: str) -> None:
        super().__init__(404, "EMBEDDING_NOT_FOUND", f"Embedding no encontrado: {embedding_id}")
