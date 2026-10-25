"""[REPOSITORY][SRP] queries async SQLAlchemy de contacto — desacopla persistencia."""

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.enums.contact_status_enum import ContactStatus
from src.module.contact.model.contact_submission_model import ContactSubmissionModel


class ContactRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_page(
        self, offset: int, limit: int, status: ContactStatus | None = None
    ) -> tuple[Sequence[ContactSubmissionModel], int]:
        stmt = select(ContactSubmissionModel)
        count_stmt = select(func.count()).select_from(ContactSubmissionModel)
        if status is not None:
            stmt = stmt.where(ContactSubmissionModel.status == status)
            count_stmt = count_stmt.where(ContactSubmissionModel.status == status)

        rows = await self._session.execute(
            stmt.order_by(ContactSubmissionModel.created_at.desc()).offset(offset).limit(limit)
        )
        total = await self._session.execute(count_stmt)
        return rows.scalars().all(), total.scalar_one()

    async def get_by_id(self, submission_id: uuid.UUID) -> ContactSubmissionModel | None:
        return await self._session.get(ContactSubmissionModel, submission_id)

    async def add(self, submission: ContactSubmissionModel) -> ContactSubmissionModel:
        self._session.add(submission)
        await self._session.flush()
        await self._session.refresh(submission)
        return submission

    async def delete(self, submission: ContactSubmissionModel) -> None:
        await self._session.delete(submission)
        await self._session.flush()
