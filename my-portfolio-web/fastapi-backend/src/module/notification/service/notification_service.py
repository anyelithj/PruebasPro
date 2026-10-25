"""[STRATEGY][SRP] orquesta el envío por canal y persiste el registro.

Selecciona el canal en runtime (whatsapp/telegram/email) y guarda el estado
resultante. El envío real vive en las estrategias; este servicio no toca HTTP.
"""

import logging
import uuid

from src.common.schemas.pagination import PaginatedResponse
from src.common.utils.pagination_util import build_page_meta, offset_of
from src.infrastructure.email.email_service import EmailPayload, EmailService
from src.module.notification.dto.send_notification_dto import (
    NotificationResponseDto,
    SendNotificationDto,
)
from src.module.notification.model.notification_model import NotificationModel
from src.module.notification.repository.notification_repository import (
    NotificationRepository,
)
from src.module.notification.strategy.messaging_interface import MessagingInterface
from src.module.notification.strategy.telegram_strategy import TelegramStrategy
from src.module.notification.strategy.whatsapp_strategy import WhatsAppStrategy

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(
        self, repository: NotificationRepository, email: EmailService
    ) -> None:
        self._repository = repository
        self._email = email
        channels: list[MessagingInterface] = [WhatsAppStrategy(), TelegramStrategy()]
        self._channels: dict[str, MessagingInterface] = {
            c.channel: c for c in channels
        }

    async def send(self, dto: SendNotificationDto) -> NotificationResponseDto:
        notification = await self._repository.add(
            NotificationModel(
                channel=dto.channel,
                recipient=dto.recipient,
                message=dto.message,
                status="pending",
                event_type=dto.event_type,
            )
        )
        try:
            await self._dispatch(dto)
            notification.status = "sent"
        except Exception as exc:  # noqa: BLE001
            logger.error("Notification dispatch failed: %s", exc)
            notification.status = "failed"
        await self._repository.update(notification)
        return NotificationResponseDto.model_validate(notification)

    async def _dispatch(self, dto: SendNotificationDto) -> None:
        if dto.channel == "email":
            await self._email.send(
                EmailPayload(to=dto.recipient, subject="Notificación", body=dto.message)
            )
            return
        channel = self._channels.get(dto.channel)
        if channel is None:
            raise ValueError(f"Canal no soportado: {dto.channel}")
        await channel.send(dto.recipient, dto.message)

    async def list(
        self, page: int, page_size: int
    ) -> PaginatedResponse[NotificationResponseDto]:
        items, total = await self._repository.list_page(
            offset_of(page, page_size), page_size
        )
        return PaginatedResponse[NotificationResponseDto](
            items=[NotificationResponseDto.model_validate(i) for i in items],
            meta=build_page_meta(page, page_size, total),
        )

    async def get_by_id(self, notification_id: uuid.UUID) -> NotificationResponseDto:
        from src.common.exceptions.not_found_exception import NotFoundException

        item = await self._repository.get_by_id(notification_id)
        if item is None:
            raise NotFoundException("Notification not found")
        return NotificationResponseDto.model_validate(item)
