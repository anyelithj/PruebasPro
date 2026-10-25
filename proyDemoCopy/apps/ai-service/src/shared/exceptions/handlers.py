"""Handlers globales que convierten excepciones en respuestas JSON uniformes.

[Patrón]: Exception Filter (Chain of Responsibility).
[Principio]: SSOT — formato { detail, code, status_code, timestamp, path }.
[Paradigma]: AOP + asíncrono.
"""
import logging
from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.shared.exceptions.custom_errors import DomainError

logger = logging.getLogger("ai-service.exceptions")


def _envelope(
    *,
    detail: str | list[str],
    code: str,
    status_code: int,
    path: str,
) -> dict:
    """Construye el envelope de error estándar. [Principio]: DRY."""
    return {
        "detail": detail,
        "code": code,
        "status_code": status_code,
        "timestamp": datetime.now(UTC).isoformat(),
        "path": path,
    }


def register_exception_handlers(app: FastAPI) -> None:
    """Engancha los handlers al FastAPI app. [Patrón]: Builder."""

    # [Handler dominio]: errores propios de la app
    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        # [Log warn]: errores de dominio son esperables, no error
        logger.warning(
            "%s %s → %d %s: %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.code,
            exc.message,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(
                detail=exc.message,
                code=exc.code,
                status_code=exc.status_code,
                path=request.url.path,
            ),
        )

    # [Handler HTTPException]: errores 4xx generados por FastAPI/Starlette
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(
                detail=str(exc.detail),
                code=f"HTTP_{exc.status_code}",
                status_code=exc.status_code,
                path=request.url.path,
            ),
        )

    # [Handler validación]: Pydantic + FastAPI body invalidation
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # [Compactar errores]: lista de mensajes legibles
        details: list[str] = [
            f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}"
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_envelope(
                detail=details,
                code="VALIDATION_ERROR",
                status_code=422,
                path=request.url.path,
            ),
        )

    # [Handler catch-all]: errores inesperados → 500 sin filtrar stack al cliente
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        # [Log error]: con stack para diagnóstico server-side
        logger.exception(
            "Unhandled exception on %s %s: %s",
            request.method,
            request.url.path,
            exc,
        )
        return JSONResponse(
            status_code=500,
            content=_envelope(
                detail="Internal server error",
                code="INTERNAL_ERROR",
                status_code=500,
                path=request.url.path,
            ),
        )
