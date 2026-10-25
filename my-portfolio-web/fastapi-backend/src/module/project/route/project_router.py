"""[SRP] APIRouter(prefix="/projects") — GET públicos, mutaciones solo admin."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from src.common.constants.roles_constants import ROLE_ADMIN
from src.common.dependencies.auth_dependency import require_roles
from src.common.schemas.api_response import ApiResponse
from src.module.project.controller.project_controller import (
    ProjectController,
    get_project_service,
)
from src.module.project.dto.create_project_dto import CreateProjectDto
from src.module.project.dto.project_response_dto import ProjectResponseDto
from src.module.project.dto.update_project_dto import UpdateProjectDto
from src.module.project.service.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])

ServiceDep = Annotated[ProjectService, Depends(get_project_service)]


@router.get("", response_model=ApiResponse[list[ProjectResponseDto]])
async def list_projects(service: ServiceDep) -> ApiResponse[list[ProjectResponseDto]]:
    return await ProjectController.list(service)


@router.get("/{project_id}", response_model=ApiResponse[ProjectResponseDto])
async def get_project(
    service: ServiceDep, project_id: uuid.UUID
) -> ApiResponse[ProjectResponseDto]:
    return await ProjectController.get(service, project_id)


@router.post(
    "",
    response_model=ApiResponse[ProjectResponseDto],
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    service: ServiceDep,
    dto: CreateProjectDto,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[ProjectResponseDto]:
    return await ProjectController.create(service, dto)


@router.patch("/{project_id}", response_model=ApiResponse[ProjectResponseDto])
async def update_project(
    service: ServiceDep,
    project_id: uuid.UUID,
    dto: UpdateProjectDto,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[ProjectResponseDto]:
    return await ProjectController.update(service, project_id, dto)


@router.delete("/{project_id}", response_model=ApiResponse[None])
async def delete_project(
    service: ServiceDep,
    project_id: uuid.UUID,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[None]:
    return await ProjectController.delete(service, project_id)
