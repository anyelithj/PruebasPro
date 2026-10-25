"""[DRY] setup SQLite in-memory async reutilizable en toda la suite."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.infrastructure.database.base_model import Base

# importa modelos para registrar tablas en Base.metadata
from src.module.auth.model.session_model import SessionModel  # noqa: F401
from src.module.user.model.user_model import UserModel  # noqa: F401


async def make_test_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()
