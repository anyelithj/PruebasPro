"""[SRP][OOP] lógica de usuarios — no toca HTTP, delega persistencia al repository."""

import uuid

from src.common.exceptions.not_found_exception import NotFoundException
from src.common.exceptions.validation_exception import ConflictException
from src.common.schemas.pagination import PaginatedResponse
from src.common.utils.hash_util import hash_password
from src.common.utils.pagination_util import build_page_meta, offset_of
from src.module.user.dto.create_user_dto import CreateUserDto
from src.module.user.dto.update_user_dto import UpdateUserDto
from src.module.user.dto.user_response_dto import UserResponseDto
from src.module.user.model.user_model import UserModel
from src.module.user.repository.user_repository import UserRepository


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    async def create(self, dto: CreateUserDto) -> UserResponseDto:
        if await self._repository.get_by_email(dto.email):
            raise ConflictException("Email already registered")
        user = UserModel(
            name=dto.name,
            email=dto.email,
            password_hash=hash_password(dto.password),
            role=dto.role.value,
        )
        created = await self._repository.add(user)
        return UserResponseDto.model_validate(created)

    async def get_by_id(self, user_id: uuid.UUID) -> UserResponseDto:
        user = await self._require(user_id)
        return UserResponseDto.model_validate(user)

    async def list(self, page: int, page_size: int) -> PaginatedResponse[UserResponseDto]:
        items, total = await self._repository.list_paginated(
            offset=offset_of(page, page_size), limit=page_size
        )
        return PaginatedResponse[UserResponseDto](
            items=[UserResponseDto.model_validate(u) for u in items],
            meta=build_page_meta(page, page_size, total),
        )

    async def update(self, user_id: uuid.UUID, dto: UpdateUserDto) -> UserResponseDto:
        user = await self._require(user_id)
        data = dto.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(user, field, value)
        updated = await self._repository.add(user)
        return UserResponseDto.model_validate(updated)

    async def delete(self, user_id: uuid.UUID) -> None:
        user = await self._require(user_id)
        await self._repository.delete(user)

    async def _require(self, user_id: uuid.UUID) -> UserModel:
        user = await self._repository.get_by_id(user_id)
        if user is None:
            raise NotFoundException("User not found")
        return user
