"""[MVC-C][SRP] capa HTTP de usuarios — solo delega al service, sin lógica."""

import uuid

from src.common.dependencies.db_dependency import DbSession
from src.common.dependencies.pagination_dependency import PaginationParams
from src.common.schemas.api_response import ApiResponse
from src.common.schemas.pagination import PaginatedResponse
from src.module.user.dto.create_user_dto import CreateUserDto
from src.module.user.dto.update_user_dto import UpdateUserDto
from src.module.user.dto.user_response_dto import UserResponseDto
from src.module.user.repository.user_repository import UserRepository
from src.module.user.service.user_service import UserService


def get_user_service(session: DbSession) -> UserService:
    """[DI] compone repository → service para cada request."""
    return UserService(UserRepository(session))


class UserController:
    """Métodos delgados: reciben service ya inyectado, devuelven ApiResponse."""

    @staticmethod
    async def create(
        service: UserService, dto: CreateUserDto
    ) -> ApiResponse[UserResponseDto]:
        return ApiResponse.ok(await service.create(dto), "User created")

    @staticmethod
    async def get(service: UserService, user_id: uuid.UUID) -> ApiResponse[UserResponseDto]:
        return ApiResponse.ok(await service.get_by_id(user_id))

    @staticmethod
    async def list(
        service: UserService, pagination: PaginationParams
    ) -> ApiResponse[PaginatedResponse[UserResponseDto]]:
        return ApiResponse.ok(await service.list(pagination.page, pagination.page_size))

    @staticmethod
    async def update(
        service: UserService, user_id: uuid.UUID, dto: UpdateUserDto
    ) -> ApiResponse[UserResponseDto]:
        return ApiResponse.ok(await service.update(user_id, dto), "User updated")

    @staticmethod
    async def delete(service: UserService, user_id: uuid.UUID) -> ApiResponse[None]:
        await service.delete(user_id)
        return ApiResponse.ok(None, "User deleted")
