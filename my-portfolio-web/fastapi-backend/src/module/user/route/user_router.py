"""[SRP] APIRouter(prefix="/users") aislado — solo mapea HTTP → controller."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from src.common.dependencies.auth_dependency import CurrentUser, require_roles
from src.common.dependencies.pagination_dependency import Pagination
from src.common.constants.roles_constants import ROLE_ADMIN
from src.common.schemas.api_response import ApiResponse
from src.common.schemas.pagination import PaginatedResponse
from src.module.user.controller.user_controller import UserController, get_user_service
from src.module.user.dto.create_user_dto import CreateUserDto
from src.module.user.dto.update_user_dto import UpdateUserDto
from src.module.user.dto.user_response_dto import UserResponseDto
from src.module.user.service.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

ServiceDep = Annotated[UserService, Depends(get_user_service)]


@router.get("/me", response_model=ApiResponse[UserResponseDto])
async def get_me(current_user: CurrentUser) -> ApiResponse[UserResponseDto]:
    return ApiResponse.ok(UserResponseDto.model_validate(current_user))


@router.get("", response_model=ApiResponse[PaginatedResponse[UserResponseDto]])
async def list_users(
    service: ServiceDep,
    pagination: Pagination,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[PaginatedResponse[UserResponseDto]]:
    return await UserController.list(service, pagination)


@router.post(
    "",
    response_model=ApiResponse[UserResponseDto],
    status_code=status.HTTP_201_CREATED,
)
async def create_user(
    service: ServiceDep,
    dto: CreateUserDto,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[UserResponseDto]:
    return await UserController.create(service, dto)


@router.get("/{user_id}", response_model=ApiResponse[UserResponseDto])
async def get_user(
    service: ServiceDep, user_id: uuid.UUID, _: CurrentUser
) -> ApiResponse[UserResponseDto]:
    return await UserController.get(service, user_id)


@router.patch("/{user_id}", response_model=ApiResponse[UserResponseDto])
async def update_user(
    service: ServiceDep,
    user_id: uuid.UUID,
    dto: UpdateUserDto,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[UserResponseDto]:
    return await UserController.update(service, user_id, dto)


@router.delete("/{user_id}", response_model=ApiResponse[None])
async def delete_user(
    service: ServiceDep,
    user_id: uuid.UUID,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[None]:
    return await UserController.delete(service, user_id)
