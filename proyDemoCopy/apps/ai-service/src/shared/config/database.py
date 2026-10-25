"""Setup SQLAlchemy async engine + session factory.

[Patrón]: Connection Pool + Factory.
[Principio]: SRP + DIP — UseCases reciben AsyncSession via dependency injection.
[Paradigma]: POO + async.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from src.shared.config.settings import get_settings


# [Engine global async]: pool de conexiones reutilizables | [Patrón]: Pool
_settings = get_settings()
engine = create_async_engine(
    _settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# [Session factory]: emite AsyncSession por request | [Patrón]: Factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Declarative base para todos los modelos ORM. [Patrón]: Active Record."""


# [Dependency factory]: yield-style para uso con FastAPI Depends | [Patrón]: Resource Acquisition
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Cede una sesión, asegura cierre en finally. [Principio]: SRP."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
