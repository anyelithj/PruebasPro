"""[LSP][SRP] 422 / 400 — validación de dominio (distinta de la de Pydantic)."""

from src.common.exceptions.app_exception import AppException


class ValidationException(AppException):
    status_code = 400
    error_code = "VALIDATION_ERROR"


class UnauthorizedException(AppException):
    status_code = 401
    error_code = "UNAUTHORIZED"


class ConflictException(AppException):
    status_code = 409
    error_code = "CONFLICT"
