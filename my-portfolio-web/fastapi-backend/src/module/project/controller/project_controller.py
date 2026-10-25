"""[MVC-C][SRP] capa HTTP de proyectos — solo delega al service, sin lógica."""

import uuid

from src.common.dependencies.db_dependency import DbSession
from src.common.schemas.api_response import ApiResponse
from src.module.project.dto.create_project_dto import CreateProjectDto
from src.module.project.dto.project_response_dto import ProjectResponseDto
from src.module.project.dto.update_project_dto import UpdateProjectDto
from src.module.project.repository.project_repository import ProjectRepository
from src.module.project.service.project_service import ProjectService


def get_project_service(session: DbSession) -> ProjectService:
    """[DI] compone repository → service para cada request."""
    return ProjectService(ProjectRepository(session))


class ProjectController:
    """Métodos delgados: reciben service ya inyectado, devuelven ApiResponse."""

    @staticmethod
    async def list(service: ProjectService) -> ApiResponse[list[ProjectResponseDto]]:
        return ApiResponse.ok(await service.list())

    @staticmethod
    async def get(
        service: ProjectService, project_id: uuid.UUID
    ) -> ApiResponse[ProjectResponseDto]:
        return ApiResponse.ok(await service.get_by_id(project_id))

    @staticmethod
    async def create(
        service: ProjectService, dto: CreateProjectDto
    ) -> ApiResponse[ProjectResponseDto]:
        return ApiResponse.ok(await service.create(dto), "Project created")

    @staticmethod
    async def update(
        service: ProjectService, project_id: uuid.UUID, dto: UpdateProjectDto
    ) -> ApiResponse[ProjectResponseDto]:
        return ApiResponse.ok(await service.update(project_id, dto), "Project updated")

    @staticmethod
    async def delete(service: ProjectService, project_id: uuid.UUID) -> ApiResponse[None]:
        await service.delete(project_id)
        return ApiResponse.ok(None, "Project deleted")
