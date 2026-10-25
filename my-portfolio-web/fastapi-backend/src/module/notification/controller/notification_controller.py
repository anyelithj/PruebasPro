"""[MVC-C][SRP] entrada HTTP de notificaciones — listado + envío. Solo delega."""

import uuid

from src.common.dependencies.db_dependency import DbSession
from src.common.schemas.api_response import ApiResponse
from src.common.schemas.pagination import PaginatedResponse
from src.infrastructure.email.email_service import EmailService
from src.module.notification.dto.send_notification_dto import (
    NotificationResponseDto,
    SendNotificationDto,
)
from src.module.notification.repository.notification_repository import (
    NotificationRepository,
)
from src.module.notification.service.notification_service import NotificationService


def build_notification_service(session: DbSession) -> NotificationService:
    """[DI] arma el NotificationService con dependencias por request."""
    return NotificationService(NotificationRepository(session), EmailService())


class NotificationController:
    @staticmethod
    async def send(
        service: NotificationService, dto: SendNotificationDto
    ) -> ApiResponse[NotificationResponseDto]:
        return ApiResponse.ok(await service.send(dto))

    @staticmethod
    async def list(
        service: NotificationService, page: int, page_size: int
    ) -> PaginatedResponse[NotificationResponseDto]:
        return await service.list(page, page_size)

    @staticmethod
    async def get(
        service: NotificationService, notification_id: uuid.UUID
    ) -> ApiResponse[NotificationResponseDto]:
        return ApiResponse.ok(await service.get_by_id(notification_id))
