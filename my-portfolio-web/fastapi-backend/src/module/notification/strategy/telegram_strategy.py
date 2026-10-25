"""[STRATEGY][OCP] canal Telegram — Bot API.

Si no hay token configurado, degrada a log (mismo criterio que EmailService stub).
httpx se importa de forma perezosa para no forzar la dependencia en runtime.
"""

import logging

from src.config.settings import settings
from src.module.notification.strategy.messaging_interface import MessagingInterface

logger = logging.getLogger(__name__)


class TelegramStrategy(MessagingInterface):
    @property
    def channel(self) -> str:
        return "telegram"

    async def send(self, to: str, message: str) -> str:
        token = settings.telegram_bot_token
        chat_id = to or settings.telegram_chat_id
        if not token or not chat_id:
            logger.info("[stub] telegram -> %s: %s", chat_id, message[:80])
            return ""

        import httpx  # import perezoso

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={"chat_id": chat_id, "text": message})
            resp.raise_for_status()
            return str(resp.json().get("result", {}).get("message_id", ""))
