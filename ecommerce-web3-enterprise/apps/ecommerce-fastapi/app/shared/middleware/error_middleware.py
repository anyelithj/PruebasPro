# error_middleware.py (FastAPI) => traduce excepciones a respuestas JSON con el MISMO contrato que
# Express: { "success": false, "message": str, "code": str, "errors"?: [...] } (error.middleware.ts)
# — los frontends no distinguen backends.
# Patrón: Chain of Responsibility (FastAPI elige el handler según el tipo de excepción) + jerarquía
# de excepciones de dominio.
# Paradigma: POO (herencia de excepciones) + funcional (handlers sin estado).

import logging  # Módulo estándar de logging (Uvicorn ya lo configura)

# Request => petición entrante (requerida por la firma del handler)
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError  # Error de validación Pydantic de FastAPI
from fastapi.responses import JSONResponse  # Respuesta JSON con status explícito

logger = logging.getLogger("ecommerce-fastapi")  # Logger con nombre del servicio


# AppError => excepción base de dominio: cada módulo la extiende (ModelNotFoundError,
# PredictionFailedError...)
# "class X(Exception)" => herencia de la excepción estándar de Python
class AppError(Exception):
    # "__init__" => constructor; "-> None" => no devuelve valor
    def __init__(self, status_code: int, code: str, message: str) -> None:
        # "super()" => llama al constructor de Exception (mensaje legible en logs)
        super().__init__(message)
        self.status_code = status_code
        self.code = code  # Código estable para el frontend (i18n por código, no por texto)
        self.message = message


# register_error_handlers => registra los handlers en la app (llamado desde main.py, Composition
# Root)
def register_error_handlers(app: FastAPI) -> None:
    # "@app.exception_handler(Tipo)" => decorador: FastAPI invoca esta función cuando se lanza ese
    # tipo
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, error: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={"success": False, "message": error.message, "code": error.code},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, error: RequestValidationError) -> JSONResponse:
        # List comprehension (programación funcional): un elemento {path, message} por campo
        # inválido
        errors = [
            {"path": ".".join(str(part) for part in issue["loc"][1:]), "message": issue["msg"]}
            for issue in error.errors()
        ]
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "Error de validación",
                "code": "VALIDATION_ERROR",
                "errors": errors,
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, error: Exception) -> JSONResponse:
        # Traza completa solo en el log, nunca al cliente
        logger.exception("unhandled_error", exc_info=error)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": "Error interno del servidor",
                "code": "INTERNAL_ERROR",
            },
        )
