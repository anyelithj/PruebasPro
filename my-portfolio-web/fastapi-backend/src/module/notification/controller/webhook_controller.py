"""[MVC-C][SRP] POST /webhook/{provider} — valida HMAC y responde 200 inmediato.

El procesamiento pesado se difiere a Celery (COMMAND); aquí solo se valida la
firma y se encola. La firma se compara en tiempo constante para evitar timing attacks.
"""

import hashlib
import hmac
import logging

from fastapi import Request

from src.common.exceptions.forbidden_exception import ForbiddenException
from src.config.settings import settings

logger = logging.getLogger(__name__)


def _verify_signature(raw_body: bytes, signature: str | None) -> None:
    """Valida la firma HMAC-SHA256 del webhook contra el secreto compartido."""
    if not signature:
        raise ForbiddenException("Missing webhook signature")
    expected = hmac.new(
        settings.webhook_hmac_secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    # Acepta con o sin prefijo "sha256=".
    provided = signature.split("=", 1)[-1]
    if not hmac.compare_digest(expected, provided):
        raise ForbiddenException("Invalid webhook signature")


class WebhookController:
    @staticmethod
    async def handle(provider: str, request: Request) -> dict:
        raw_body = await request.body()
        signature = request.headers.get("X-Signature") or request.headers.get(
            "X-Hub-Signature-256"
        )
        _verify_signature(raw_body, signature)
        # 200 OK inmediato; el trabajo real se difiere a la cola (Celery).
        logger.info("Webhook accepted from provider=%s (%d bytes)", provider, len(raw_body))
        return {"success": True, "data": {"provider": provider, "accepted": True}}
