"""[REPOSITORY][SRP] queries async SQLAlchemy — desacopla la persistencia del negocio."""

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.module.user.model.user_model import UserModel


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: uuid.UUID) -> UserModel | None:
        return await self._session.get(UserModel, user_id)

    async def get_by_email(self, email: str) -> UserModel | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.email == email)
        )
        return result.scalar_one_or_none()

    async def list_paginated(
        self, offset: int, limit: int
    ) -> tuple[Sequence[UserModel], int]:
        total = await self._session.scalar(select(func.count()).select_from(UserModel))
        result = await self._session.execute(
            select(UserModel).order_by(UserModel.created_at.desc()).offset(offset).limit(limit)
        )
        return result.scalars().all(), int(total or 0)

    async def add(self, user: UserModel) -> UserModel:
        self._session.add(user)
        await self._session.flush()
        await self._session.refresh(user)
        return user

    async def delete(self, user: UserModel) -> None:
        await self._session.delete(user)
        await self._session.flush()
