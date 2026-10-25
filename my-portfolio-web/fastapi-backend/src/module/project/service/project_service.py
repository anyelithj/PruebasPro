"""[SRP][OOP] lógica de proyectos — no toca HTTP, delega persistencia al repository."""

import uuid

from src.common.exceptions.not_found_exception import NotFoundException
from src.common.utils.slug_util import slugify
from src.module.project.dto.create_project_dto import CreateProjectDto
from src.module.project.dto.project_response_dto import ProjectResponseDto
from src.module.project.dto.update_project_dto import UpdateProjectDto
from src.module.project.model.project_model import ProjectModel
from src.module.project.repository.project_repository import ProjectRepository


class ProjectService:
    def __init__(self, repository: ProjectRepository) -> None:
        self._repository = repository

    async def list(self) -> list[ProjectResponseDto]:
        projects = await self._repository.list_all()
        return [ProjectResponseDto.model_validate(p) for p in projects]

    async def get_by_id(self, project_id: uuid.UUID) -> ProjectResponseDto:
        project = await self._require(project_id)
        return ProjectResponseDto.model_validate(project)

    async def create(self, dto: CreateProjectDto) -> ProjectResponseDto:
        project = ProjectModel(
            title=dto.title,
            slug=await self._unique_slug(dto.title),
            description=dto.description,
            link=dto.link,
            techs=dto.techs,
            featured=dto.featured,
        )
        created = await self._repository.add(project)
        return ProjectResponseDto.model_validate(created)

    async def update(self, project_id: uuid.UUID, dto: UpdateProjectDto) -> ProjectResponseDto:
        project = await self._require(project_id)
        data = dto.model_dump(exclude_unset=True)
        if "title" in data:
            project.slug = await self._unique_slug(data["title"], exclude_id=project_id)
        for field, value in data.items():
            setattr(project, field, value)
        updated = await self._repository.add(project)
        return ProjectResponseDto.model_validate(updated)

    async def delete(self, project_id: uuid.UUID) -> None:
        project = await self._require(project_id)
        await self._repository.delete(project)

    async def _require(self, project_id: uuid.UUID) -> ProjectModel:
        project = await self._repository.get_by_id(project_id)
        if project is None:
            raise NotFoundException("Project not found")
        return project

    async def _unique_slug(self, title: str, exclude_id: uuid.UUID | None = None) -> str:
        base = slugify(title) or "project"
        candidate = base
        n = 1
        while True:
            existing = await self._repository.get_by_slug(candidate)
            if existing is None or existing.id == exclude_id:
                return candidate
            n += 1
            candidate = f"{base}-{n}"
