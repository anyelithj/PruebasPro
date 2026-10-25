"""[DDD] entidad mensaje de chat IA (SQLAlchemy ORM).

Guarda el historial de conversación por sesión. Los usuarios autenticados
conservan su historial; las sesiones anónimas se identifican solo por session_id.
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database.base_model import BaseModel
from src.infrastructure.database.types import GUID


class MessageModel(BaseModel):
    __tablename__ = "chat_messages"

    session_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    # "user" | "assistant" — quién emitió el mensaje.
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Usuario autenticado dueño de la sesión (opcional para sesiones anónimas).
    user_id: Mapped[str | None] = mapped_column(GUID(), index=True, nullable=True)
