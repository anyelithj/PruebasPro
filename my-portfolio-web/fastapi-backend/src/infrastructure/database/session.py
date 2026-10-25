"""[SRP][DI] get_db factory — provee AsyncSession por request, commit/rollback gestionado."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import async_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """[DI] dependencia FastAPI: abre sesión, commit al final, rollback ante error."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
