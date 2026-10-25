"""[CC-F2] factory mínima — delega configuración a helpers; ensambla la app FastAPI."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.exceptions import RequestValidationError

from src.common.exceptions.app_exception import AppException
from src.common.exceptions.blockchain_exception import BlockchainException
from src.common.handlers.app_exception_handler import app_exception_handler
from src.common.handlers.blockchain_exception_handler import blockchain_exception_handler
from src.common.handlers.validation_exception_handler import validation_exception_handler
from src.common.middleware.cors_middleware import setup_cors
from src.common.middleware.logging_middleware import LoggingMiddleware
from src.common.middleware.rate_limit_middleware import RateLimitMiddleware
from src.common.middleware.security_middleware import SecurityHeadersMiddleware
from src.common.schemas.api_response import ApiResponse
from src.config.database import dispose_engine
from src.config.redis import close_redis
from src.config.settings import settings
from src.infrastructure.grpc.grpc_server import start_grpc_server, stop_grpc_server
from src.module.auth.route.auth_router import router as auth_router
from src.module.blockchain.blockchain_module import (
    get_blockchain_router,
    get_blockchain_ws_routers,
)
from src.module.chat.controller.chat_ws_controller import ws_router as chat_ws_router
from src.module.chat.route.chat_router import router as chat_router
from src.module.contact.route.contact_router import router as contact_router
from src.module.ml.route.ml_router import router as ml_router
from src.module.notification.route.notification_router import router as notification_router
from src.module.project.route.project_router import router as project_router
from src.module.user.route.user_router import router as user_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # [SRP] arranque de recursos externos (servidor gRPC hacia NestJS).
    await start_grpc_server()
    yield
    # [SRP] cierre ordenado de recursos externos.
    await stop_grpc_server()
    await dispose_engine()
    await close_redis()


def _build_api_router() -> APIRouter:
    """[FACADE] agrupa todos los routers de negocio bajo un único prefijo versionado."""
    api = APIRouter()
    api.include_router(auth_router)
    api.include_router(user_router)
    api.include_router(project_router)
    api.include_router(contact_router)
    api.include_router(chat_router)
    api.include_router(notification_router)
    api.include_router(get_blockchain_router())
    api.include_router(ml_router)
    return api


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        debug=settings.app_debug,
        lifespan=lifespan,
    )

    # [CHAIN-OF-RESPONSIBILITY] orden: security → rate_limit → logging → cors → ruta.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(LoggingMiddleware)
    setup_cors(app)

    # BlockchainException antes que AppException: el handler específico gana.
    app.add_exception_handler(BlockchainException, blockchain_exception_handler)
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    app.include_router(_build_api_router(), prefix=settings.api_prefix)

    # [OBSERVER] WebSockets — se montan en la raíz (fuera del prefijo REST versionado).
    app.include_router(chat_ws_router)
    for ws_router in get_blockchain_ws_routers():
        app.include_router(ws_router)

    @app.get("/health", response_model=ApiResponse[dict], tags=["health"])
    async def health() -> ApiResponse[dict]:
        return ApiResponse.ok({"status": "ok", "env": settings.app_env})

    return app


app = create_app()
