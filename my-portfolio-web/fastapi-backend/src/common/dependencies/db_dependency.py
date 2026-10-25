"""[DI][SRP] alias tipado de la sesión async — reutilizable en cualquier endpoint."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.database.session import get_db

DbSession = Annotated[AsyncSession, Depends(get_db)]
