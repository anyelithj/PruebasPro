"""[DRY] handler único para errores blockchain — RPC/TX → JSON estándar.

Nunca incluye claves privadas ni datos sensibles en la respuesta.
"""

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from src.common.exceptions.blockchain_exception import BlockchainException

logger = logging.getLogger(__name__)


async def blockchain_exception_handler(
    _: Request, exc: BlockchainException
) -> JSONResponse:
    # Logging seguro: mensaje del error, jamás claves ni payloads firmados.
    logger.warning("Blockchain error [%s]: %s", exc.error_code, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": {"code": exc.error_code, "message": exc.message},
        },
    )
