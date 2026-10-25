# database_config.py (SQLAlchemy 2.0 async + asyncpg) => conexión a PostgreSQL compartida por todos
# los módulos ML. Patrón: Singleton (un engine con pool por proceso) + Unit of Work (una
# AsyncSession por request,
# con commit/rollback).
# Paradigma: asíncrono (async/await: la E/S de BD no bloquea el event loop de Uvicorn) + POO (Base
# declarativa).

# Tipo de un generador asíncrono (lo que devuelve get_session)
from collections.abc import AsyncIterator

from sqlalchemy import MetaData, delete  # MetaData fija el esquema; delete => DELETE masivo

# API async de SQLAlchemy
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Base de los modelos ORM (estilo declarativo 2.0, tipado)
from sqlalchemy.orm import DeclarativeBase

from app.config.app_config import get_settings  # Singleton de configuración

# Esquema propio "ml": Prisma (Express) solo administra "public"; así "prisma migrate dev" no ve
# estas tablas como deriva (drift) ni propone borrarlas, y Alembic solo versiona las tablas del
# motor IA.
ML_SCHEMA = "ml"


# "class Base(DeclarativeBase)" => clase raíz de todos los modelos; "metadata" con schema => cada
# tabla vive en "ml"
class Base(DeclarativeBase):
    metadata = MetaData(schema=ML_SCHEMA)


# "create_async_engine" => pool de conexiones asyncpg; "pool_pre_ping" descarta conexiones caídas
# antes de usarlas
engine = create_async_engine(get_settings().DATABASE_URL, pool_pre_ping=True)

# "async_sessionmaker" => fábrica (patrón Factory) de sesiones; "expire_on_commit=False" => los
# objetos siguen legibles después del commit (necesario para serializar la respuesta sin otra
# consulta)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


# get_session => dependencia de FastAPI (Depends): abre una sesión por request y la cierra al
# terminar
async def get_session() -> AsyncIterator[AsyncSession]:
    # "async with" => context manager asíncrono: cierra la sesión aunque ocurra una excepción
    async with SessionFactory() as session:
        # "yield" => entrega la sesión al endpoint; el código posterior corre al finalizar la
        # respuesta
        yield session


# SqlRepository[T] => repositorio base genérico (PEP 695): las operaciones comunes de TODAS las
# entidades viven aquí una sola vez (DRY); cada módulo hereda y agrega solo sus consultas propias.
# Patrón: Repository + Template (herencia) + Unit of Work (el service decide el commit).
class SqlRepository[T: Base]:
    entity: type[T]  # Lo fija cada subclase: "entity = SentimentResult"

    def __init__(self, session: AsyncSession) -> None:
        self.session = session  # Inyección de dependencias (DIP): testeable con otra sesión

    async def get(self, entity_id: str) -> T | None:
        return await self.session.get(self.entity, entity_id)  # Por clave primaria (identity map)

    async def add(self, instance: T) -> T:
        self.session.add(instance)
        await self.session.flush()  # Envía el INSERT: rellena valores por defecto antes del commit
        return instance

    async def delete(self, instance: T) -> None:
        await self.session.delete(instance)

    # delete_all => vacía la tabla en una sola sentencia (las cachés "DELETE_ALL" de la matriz)
    async def delete_all(self) -> int:
        return (await self.session.execute(delete(self.entity))).rowcount

    async def commit(self) -> None:
        await self.session.commit()

    # refresh => relee columnas asignadas por la BD (created_at) o relaciones recién creadas
    async def refresh(self, instance: T, attributes: list[str] | None = None) -> None:
        await self.session.refresh(instance, attributes)
