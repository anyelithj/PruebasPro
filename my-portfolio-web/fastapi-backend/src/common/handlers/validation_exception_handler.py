"""[DRY] un solo lugar para 422 de Pydantic/FastAPI en formato ApiResponse."""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


async def validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "UNPROCESSABLE_ENTITY",
                "message": "Validation failed",
                "details": exc.errors(),
            },
            "data": None,
        },
    )
