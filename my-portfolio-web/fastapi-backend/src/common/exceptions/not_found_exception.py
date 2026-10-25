"""[LSP][SRP] 404 — sustituible por AppException sin romper handlers."""

from src.common.exceptions.app_exception import AppException


class NotFoundException(AppException):
    status_code = 404
    error_code = "NOT_FOUND"
