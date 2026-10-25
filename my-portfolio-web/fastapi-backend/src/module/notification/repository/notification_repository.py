"""[REPOSITORY][SRP] persistencia de notificaciones — SQLAlchemy async."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.module.notification.model.notification_model import NotificationModel


class NotificationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, notification: NotificationModel) -> NotificationModel:
        self._session.add(notification)
        await self._session.commit()
        await self._session.refresh(notification)
        return notification

    async def update(self, notification: NotificationModel) -> NotificationModel:
        await self._session.commit()
        await self._session.refresh(notification)
        return notification

    async def get_by_id(self, notification_id: uuid.UUID) -> NotificationModel | None:
        return await self._session.get(NotificationModel, notification_id)

    async def list_page(
        self, offset: int, limit: int
    ) -> tuple[list[NotificationModel], int]:
        rows = await self._session.execute(
            select(NotificationModel)
            .order_by(NotificationModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        from sqlalchemy import func

        total = await self._session.scalar(
            select(func.count()).select_from(NotificationModel)
        )
        return list(rows.scalars().all()), int(total or 0)
