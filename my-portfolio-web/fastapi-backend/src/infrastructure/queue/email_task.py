"""[COMMAND][SRP] job de email asíncrono — encapsula el envío diferido."""

import asyncio

from src.infrastructure.email.email_service import EmailPayload, EmailService
from src.infrastructure.queue.worker import celery_app


@celery_app.task(name="email.send")
def send_email_task(to: str, subject: str, body: str) -> None:
    """Envía un email fuera del ciclo request/response."""
    service = EmailService()
    asyncio.run(service.send(EmailPayload(to=to, subject=subject, body=body)))
