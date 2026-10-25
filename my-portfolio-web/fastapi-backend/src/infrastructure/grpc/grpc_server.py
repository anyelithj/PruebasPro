"""[SRP] servidor gRPC async — startup/shutdown, registra los servicers disponibles.

Import perezoso de grpc.aio. Cada servicer se registra solo si sus stubs existen,
así el servidor arranca aunque la codegen aún no se haya ejecutado.
"""

import logging
from typing import Any

from src.config.settings import settings
from src.infrastructure.grpc import (
    auth_grpc_servicer,
    blockchain_grpc_servicer,
    chat_grpc_servicer,
)

logger = logging.getLogger(__name__)

_server: Any = None


async def start_grpc_server() -> None:
    """Arranca el servidor gRPC en el puerto configurado."""
    global _server
    try:
        import grpc  # grpc.aio
    except ImportError:
        logger.warning("grpcio no instalado — servidor gRPC deshabilitado")
        return

    _server = grpc.aio.server()
    registered = [
        auth_grpc_servicer.register(_server),
        chat_grpc_servicer.register(_server),
        blockchain_grpc_servicer.register(_server),
    ]
    if not any(registered):
        logger.warning("Ningún servicer gRPC registrado — ejecuta `make proto`")

    address = f"{settings.grpc_host}:{settings.grpc_port}"
    _server.add_insecure_port(address)
    await _server.start()
    logger.info("gRPC server escuchando en %s", address)


async def stop_grpc_server() -> None:
    if _server is not None:
        await _server.stop(grace=5)
        logger.info("gRPC server detenido")
