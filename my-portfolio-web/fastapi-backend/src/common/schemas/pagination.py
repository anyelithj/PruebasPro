"""[DRY][LSP] PaginatedResponse[T] genérico — cualquier listado paginado lo reutiliza."""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    meta: PageMeta
