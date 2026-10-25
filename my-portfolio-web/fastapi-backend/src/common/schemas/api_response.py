"""[DRY] ApiResponse[T] genérico — formato de respuesta estándar de toda la API."""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None

    @classmethod
    def ok(cls, data: T, message: str | None = None) -> "ApiResponse[T]":
        return cls(success=True, data=data, message=message)
