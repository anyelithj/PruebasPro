"""[DDD] entidad de envío de contacto (SQLAlchemy ORM)."""

from sqlalchemy import Enum as SaEnum
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.common.enums.contact_status_enum import ContactStatus
from src.infrastructure.database.base_model import BaseModel


class ContactSubmissionModel(BaseModel):
    __tablename__ = "contact_submissions"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ContactStatus] = mapped_column(
        SaEnum(ContactStatus, name="contact_status", native_enum=False),
        default=ContactStatus.PENDING,
        nullable=False,
        index=True,
    )
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
