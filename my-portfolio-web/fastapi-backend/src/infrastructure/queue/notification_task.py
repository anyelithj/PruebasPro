"""[COMMAND][SRP] job de notificación asíncrono — canal WhatsApp/Telegram diferido."""

import asyncio

from src.infrastructure.queue.worker import celery_app
from src.module.notification.strategy.telegram_strategy import TelegramStrategy
from src.module.notification.strategy.whatsapp_strategy import WhatsAppStrategy

_CHANNELS = {
    "telegram": TelegramStrategy,
    "whatsapp": WhatsAppStrategy,
}


@celery_app.task(name="notification.send")
def send_notification_task(channel: str, to: str, message: str) -> str:
    """Envía una notificación por el canal indicado, fuera del request."""
    strategy_cls = _CHANNELS.get(channel)
    if strategy_cls is None:
        return ""
    return asyncio.run(strategy_cls().send(to, message))
