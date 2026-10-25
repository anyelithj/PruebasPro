# pagination_util.py (FastAPI + SQLAlchemy) => paginación por página/límite reutilizada por todos
# los listados (DRY). Límite máximo de 100 filas: respuestas pequeñas = menos memoria, red y
# energía. Patrón: Util + Value Object (PageParams). Paradigma: funcional (funciones puras) +
# asíncrono.

import math
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.types.common_types import PageMeta


# PageParams => Value Object inmutable con la página pedida
@dataclass(frozen=True)
class PageParams:
    page: int
    limit: int

    @property  # "@property" => se lee como atributo (params.offset), se calcula al vuelo
    def offset(self) -> int:
        return (self.page - 1) * self.limit


# page_params => dependencia FastAPI: lee y valida ?page=&limit= (400 si están fuera de rango)
def page_params(
    page: Annotated[int, Query(ge=1)] = 1, limit: Annotated[int, Query(ge=1, le=100)] = 20
) -> PageParams:
    return PageParams(page, limit)


Page = Annotated[PageParams, Depends(page_params)]  # Alias para los controllers: "params: Page"


# paginate => ejecuta COUNT + página de resultados de un SELECT ORM; devuelve (filas, meta)
async def paginate(
    session: AsyncSession, query: Select, params: PageParams
) -> tuple[list[Any], PageMeta]:
    total = (await session.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = list((await session.execute(query.offset(params.offset).limit(params.limit))).scalars())
    pages = math.ceil(total / params.limit) if total else 0  # "math.ceil" => redondeo hacia arriba
    return rows, PageMeta(page=params.page, limit=params.limit, total=total, total_pages=pages)
