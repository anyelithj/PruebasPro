"""Dependency wrapper para inyectar AsyncSession en endpoints.

[Patrón]: Dependency Injection.
[Principio]: SRP — re-exporta la session factory bajo Annotated tipado.
[Paradigma]: Funcional.
"""
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.shared.config.database import get_db_session

# [Alias tipado]: usar como `session: DbSessionDep` en endpoints
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
