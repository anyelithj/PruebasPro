"""[DRY][CHAIN-OF-RESPONSIBILITY] un solo lugar para traducir AppException → HTTP."""

from fastapi import Request
from fastapi.responses import JSONResponse

from src.common.exceptions.app_exception import AppException


async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {"code": exc.error_code, "message": exc.message},
            "data": None,
        },
    )
