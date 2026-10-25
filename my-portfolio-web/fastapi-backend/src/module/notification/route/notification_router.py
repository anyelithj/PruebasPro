"""[SRP] APIRouter(prefix="/notifications") — CRUD admin + webhooks públicos."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from src.common.constants.roles_constants import ROLE_ADMIN
from src.common.dependencies.auth_dependency import require_roles
from src.common.dependencies.pagination_dependency import PaginationParams
from src.common.schemas.api_response import ApiResponse
from src.common.schemas.pagination import PaginatedResponse
from src.module.notification.controller.notification_controller import (
    NotificationController,
    build_notification_service,
)
from src.module.notification.controller.webhook_controller import WebhookController
from src.module.notification.dto.send_notification_dto import (
    NotificationResponseDto,
    SendNotificationDto,
)
from src.module.notification.service.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])

ServiceDep = Annotated[NotificationService, Depends(build_notification_service)]
AdminDep = Annotated[object, Depends(require_roles(ROLE_ADMIN))]


@router.post("", response_model=ApiResponse[NotificationResponseDto])
async def send_notification(
    service: ServiceDep, dto: SendNotificationDto, _: AdminDep
) -> ApiResponse[NotificationResponseDto]:
    return await NotificationController.send(service, dto)


@router.get("", response_model=PaginatedResponse[NotificationResponseDto])
async def list_notifications(
    service: ServiceDep,
    pagination: Annotated[PaginationParams, Depends()],
    _: AdminDep,
) -> PaginatedResponse[NotificationResponseDto]:
    return await NotificationController.list(
        service, pagination.page, pagination.page_size
    )


@router.get("/{notification_id}", response_model=ApiResponse[NotificationResponseDto])
async def get_notification(
    service: ServiceDep, notification_id: uuid.UUID, _: AdminDep
) -> ApiResponse[NotificationResponseDto]:
    return await NotificationController.get(service, notification_id)


@router.post("/webhook/{provider}")
async def receive_webhook(provider: str, request: Request) -> dict:
    """Endpoint público con validación HMAC — n8n / WhatsApp / Telegram."""
    return await WebhookController.handle(provider, request)
