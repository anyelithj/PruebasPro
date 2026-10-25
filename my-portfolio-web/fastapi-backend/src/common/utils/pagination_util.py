"""[FP][DRY] cálculos de paginación puros."""

from math import ceil

from src.common.schemas.pagination import PageMeta


def offset_of(page: int, page_size: int) -> int:
    return (page - 1) * page_size


def build_page_meta(page: int, page_size: int, total: int) -> PageMeta:
    total_pages = ceil(total / page_size) if page_size else 0
    return PageMeta(page=page, page_size=page_size, total=total, total_pages=total_pages)
