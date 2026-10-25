"""Jerarquía de errores de dominio del servicio IA.

[Patrón]: Custom Exception Hierarchy.
[Principio]: SRP — cada error captura una causa específica.
[Paradigma]: POO.
"""


class DomainError(Exception):
    """Base para todos los errores de dominio del servicio."""

    status_code: int = 400
    code: str = "DOMAIN_ERROR"

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code


class ValidationDomainError(DomainError):
    """Datos de entrada inválidos según reglas de dominio."""

    status_code = 422
    code = "VALIDATION_ERROR"


class NotFoundDomainError(DomainError):
    """Recurso solicitado no existe."""

    status_code = 404
    code = "NOT_FOUND"


class UnauthorizedDomainError(DomainError):
    """Falta autenticación o token inválido."""

    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenDomainError(DomainError):
    """Autenticado pero sin permiso suficiente."""

    status_code = 403
    code = "FORBIDDEN"


class ModelInferenceError(DomainError):
    """Falla durante inferencia de un modelo IA (timeout, OOM, modelo inválido)."""

    status_code = 503
    code = "MODEL_INFERENCE_ERROR"


class ExternalServiceError(DomainError):
    """Servicio externo (Ollama, backend NestJS) no responde."""

    status_code = 502
    code = "EXTERNAL_SERVICE_ERROR"
