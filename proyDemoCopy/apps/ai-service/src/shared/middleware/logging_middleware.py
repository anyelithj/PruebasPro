"""Middleware de request logging con latencia.

[Patrón]: Middleware + AOP.
[Principio]: SRP.
[Paradigma]: AOP + asíncrono.
"""
import logging
import time
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

logger = logging.getLogger("ai-service.http")


def setup_logging_middleware(app: FastAPI) -> None:
    """Registra middleware que mide latencia y registra cada request."""

    @app.middleware("http")
    async def log_request(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # [Mark inicio]: perf_counter es monotónico y de alta resolución
        started = time.perf_counter()
        response: Response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000

        # [Log]: nivel según status — 5xx error, >=400 warn, resto info
        log_level = (
            logging.ERROR
            if response.status_code >= 500
            else logging.WARNING
            if response.status_code >= 400
            else logging.INFO
        )
        logger.log(
            log_level,
            "%s %s → %d · %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response
