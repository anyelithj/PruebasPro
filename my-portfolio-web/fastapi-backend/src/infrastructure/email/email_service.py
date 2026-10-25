"""[STRATEGY][SRP] envío de emails — STUB (vertical slice): loguea en vez de enviar.

Espejo del EmailService de Nest. TODO(vertical-slice): proveedor real (SES/Resend/SMTP).
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailPayload:
    to: str
    subject: str
    body: str


class EmailService:
    async def send(self, payload: EmailPayload) -> None:
        logger.info("[stub] email -> %s: %s", payload.to, payload.subject)
