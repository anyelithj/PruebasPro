"""[DI][DRY] PaginationParams reutilizable — validado y clamped una sola vez."""

from typing import Annotated

from fastapi import Depends, Query

from src.common.constants.app_constants import (
    DEFAULT_PAGE,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
)


class PaginationParams:
    def __init__(
        self,
        page: int = Query(DEFAULT_PAGE, ge=1),
        page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    ) -> None:
        self.page = page
        self.page_size = page_size


Pagination = Annotated[PaginationParams, Depends(PaginationParams)]
