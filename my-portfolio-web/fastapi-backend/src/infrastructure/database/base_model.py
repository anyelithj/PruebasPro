"""[DRY][OOP] base declarativa con UUID + timestamps — heredada por toda entidad."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from src.infrastructure.database.types import GUID


class Base(DeclarativeBase):
    """Base declarativa raíz — target de Alembic autogenerate."""


class BaseModel(Base):
    """[DRY] mixin abstracto: id UUID + created_at/updated_at automáticos."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        primary_key=True,
        default=uuid.uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
