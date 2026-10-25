"""[LSP][SRP] 403 — acceso denegado."""

from src.common.exceptions.app_exception import AppException


class ForbiddenException(AppException):
    status_code = 403
    error_code = "FORBIDDEN"
