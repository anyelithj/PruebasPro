# env.py (Alembic + SQLAlchemy async) => script que Alembic ejecuta en cada "alembic
# upgrade/revision". Basado en la plantilla oficial "async" (alembic init -t async), con la URL
# leída del entorno (12-Factor).

import asyncio  # Módulo estándar: ejecuta corrutinas desde código síncrono (asyncio.run)

# Configura logging a partir de las secciones [loggers] de alembic.ini
from logging.config import fileConfig

from alembic import context  # Contexto de migración (modo online/offline, transacciones)

# pool => estrategias de conexión; text => SQL literal (CREATE SCHEMA)
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection  # Tipo de la conexión síncrona que recibe run_sync
from sqlalchemy.ext.asyncio import async_engine_from_config  # Crea un AsyncEngine (driver asyncpg)

# Importa los modelos para registrar sus tablas en Base.metadata (lo necesita autogenerate)
import app.module.customer_analytics.model.customer_analytics_model  # noqa: F401
import app.module.demand_forecasting.model.forecasting_model  # noqa: F401
import app.module.email_parser.model.email_parser_model  # noqa: F401
import app.module.fraud_detection.model.fraud_detection_model  # noqa: F401
import app.module.image_recognition.model.image_recognition_model  # noqa: F401
import app.module.llm_assistant.model.llm_model  # noqa: F401
import app.module.ml_prediction.model.ml_prediction_model  # noqa: F401
import app.module.natural_language.model.nlp_model  # noqa: F401
import app.module.personalization.model.personalization_model  # noqa: F401
import app.module.price_optimization.model.pricing_model  # noqa: F401
import app.module.sentiment_analysis.model.sentiment_model  # noqa: F401

# Lee DATABASE_URL del entorno o de .env (misma fuente que la API)
from app.config.app_config import get_settings
from app.config.database_config import ML_SCHEMA, Base

# "config" => objeto con los valores de alembic.ini
config = context.config

# Inyecta la URL en tiempo de ejecución (12-Factor: nunca escrita en alembic.ini)
config.set_main_option("sqlalchemy.url", get_settings().DATABASE_URL)

# "is not None" => comparación de identidad con None (idiomático en Python)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata de los modelos para "alembic revision --autogenerate" (tablas del esquema "ml")
target_metadata = Base.metadata


# "def" => define función | "-> None" => no devuelve valor
# Modo offline: genera SQL sin conectarse a la base de datos (útil para revisar scripts antes de
# aplicarlos)
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,  # Inserta los valores literales en el SQL generado
        dialect_opts={"paramstyle": "named"},
    )
    # "with" => context manager: abre y cierra la transacción automáticamente (patrón RAII)
    with context.begin_transaction():
        context.run_migrations()


# Ejecuta las migraciones sobre una conexión síncrona (Alembic es síncrono internamente)
def do_run_migrations(connection: Connection) -> None:
    # Idempotente: el esquema existe antes de migrar
    connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {ML_SCHEMA}"))
    # "commit()" => cierra la transacción implícita (autobegin de SQLAlchemy 2.0); sin esto la
    # transacción de Alembic quedaría anidada y las tablas se revertirían al cerrar la conexión
    connection.commit()
    # "version_table_schema" => alembic_version vive en "ml" (Prisma no la ve); "include_schemas" =>
    # compara solo "ml"
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=ML_SCHEMA,
        include_schemas=True,
        include_name=lambda name, type_, _: type_ != "schema" or name == ML_SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()


# "async def" => corrutina | "await" => espera I/O sin bloquear el event loop
async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",  # Toma las claves "sqlalchemy.*" (url) de la configuración
        poolclass=pool.NullPool,  # Sin pool: una migración es un proceso corto
    )
    # "async with" => context manager asíncrono: libera la conexión aunque ocurra una excepción
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)  # Puente async -> sync
    await connectable.dispose()  # Cierra el engine


# Modo online: conecta a PostgreSQL y aplica las migraciones
def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# "if/else" => Alembic decide el modo según el flag --sql de la línea de comandos
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
