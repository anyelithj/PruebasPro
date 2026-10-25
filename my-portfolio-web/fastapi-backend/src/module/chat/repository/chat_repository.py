"""[REPOSITORY][SRP] persistencia de mensajes de chat — SQLAlchemy async."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.module.chat.model.message_model import MessageModel


class ChatRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, message: MessageModel) -> MessageModel:
        self._session.add(message)
        await self._session.commit()
        await self._session.refresh(message)
        return message

    async def history(self, session_id: str, limit: int = 20) -> list[MessageModel]:
        """Últimos `limit` mensajes de la sesión, en orden cronológico."""
        result = await self._session.execute(
            select(MessageModel)
            .where(MessageModel.session_id == session_id)
            .order_by(MessageModel.created_at.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        rows.reverse()
        return rows
