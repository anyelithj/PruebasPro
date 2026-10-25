"""Alembic env — async engine + autogenerate contra Base.metadata."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.pool import NullPool

from src.config.settings import settings
from src.infrastructure.database.base_model import Base

# [DDD] importa todos los modelos para que Base.metadata los registre.
from src.module.auth.model.password_reset_token_model import (  # noqa: F401
    PasswordResetTokenModel,
)
from src.module.auth.model.session_model import SessionModel  # noqa: F401
from src.module.blockchain.ethereum.model.ethereum_interaction_model import (  # noqa: F401
    EthereumInteractionModel,
)
from src.module.blockchain.solana.model.solana_interaction_model import (  # noqa: F401
    SolanaInteractionModel,
)
from src.module.chat.model.message_model import MessageModel  # noqa: F401
from src.module.contact.model.contact_submission_model import (  # noqa: F401
    ContactSubmissionModel,
)
from src.module.notification.model.notification_model import (  # noqa: F401
    NotificationModel,
)
from src.module.project.model.project_model import ProjectModel  # noqa: F401
from src.module.user.model.user_model import UserModel  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        {"sqlalchemy.url": settings.database_url},
        prefix="sqlalchemy.",
        poolclass=NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
