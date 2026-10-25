"""[SRP] engine async SQLAlchemy aislado — creación y disposición del engine."""

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from src.config.settings import settings

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# [DI] factory de sesiones — consumida por get_db en infrastructure/database/session.py
async_session_factory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
)


async def dispose_engine() -> None:
    await engine.dispose()
