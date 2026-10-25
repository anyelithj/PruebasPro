"""[DDD] entidad de notificación (SQLAlchemy ORM) — registro de cada envío."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database.base_model import BaseModel


class NotificationModel(BaseModel):
    __tablename__ = "notifications"

    # Canal de entrega: "whatsapp" | "telegram" | "email".
    channel: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Estado del envío: "pending" | "sent" | "failed".
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    # Evento del sistema que originó la notificación (opcional).
    event_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
