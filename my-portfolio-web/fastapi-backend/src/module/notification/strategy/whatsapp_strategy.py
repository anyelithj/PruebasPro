"""[STRATEGY][OCP] canal WhatsApp — WhatsApp Business Cloud API.

Si faltan credenciales, degrada a log. httpx perezoso.
"""

import logging

from src.config.settings import settings
from src.module.notification.strategy.messaging_interface import MessagingInterface

logger = logging.getLogger(__name__)


class WhatsAppStrategy(MessagingInterface):
    @property
    def channel(self) -> str:
        return "whatsapp"

    async def send(self, to: str, message: str) -> str:
        token = settings.whatsapp_token
        phone_id = settings.whatsapp_phone_id
        if not token or not phone_id:
            logger.info("[stub] whatsapp -> %s: %s", to, message[:80])
            return ""

        import httpx  # import perezoso

        url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": message},
        }
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            messages = resp.json().get("messages", [{}])
            return str(messages[0].get("id", ""))
