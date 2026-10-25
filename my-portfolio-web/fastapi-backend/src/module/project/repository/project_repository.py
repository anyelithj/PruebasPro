"""[REPOSITORY][SRP] queries async SQLAlchemy de proyecto — desacopla persistencia."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.module.project.model.project_model import ProjectModel


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> Sequence[ProjectModel]:
        result = await self._session.execute(
            select(ProjectModel).order_by(
                ProjectModel.featured.desc(), ProjectModel.created_at.desc()
            )
        )
        return result.scalars().all()

    async def get_by_id(self, project_id: uuid.UUID) -> ProjectModel | None:
        return await self._session.get(ProjectModel, project_id)

    async def get_by_slug(self, slug: str) -> ProjectModel | None:
        result = await self._session.execute(
            select(ProjectModel).where(ProjectModel.slug == slug)
        )
        return result.scalar_one_or_none()

    async def add(self, project: ProjectModel) -> ProjectModel:
        self._session.add(project)
        await self._session.flush()
        await self._session.refresh(project)
        return project

    async def delete(self, project: ProjectModel) -> None:
        await self._session.delete(project)
        await self._session.flush()
