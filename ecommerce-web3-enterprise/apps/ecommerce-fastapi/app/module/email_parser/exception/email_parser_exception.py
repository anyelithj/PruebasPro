# email_parser_exception.py (Python) => excepciones de dominio del analizador de correos.
# Patrón: jerarquía de excepciones (AppError). Paradigma: POO.

from app.shared.middleware.error_middleware import AppError


class ParsedEmailNotFoundError(AppError):
    def __init__(self, email_id: str) -> None:
        super().__init__(
            404, "PARSED_EMAIL_NOT_FOUND", f"Correo analizado no encontrado: {email_id}"
        )


class ParseFailedError(AppError):
    def __init__(self) -> None:
        super().__init__(422, "PARSE_FAILED", "El correo no tiene texto analizable")
