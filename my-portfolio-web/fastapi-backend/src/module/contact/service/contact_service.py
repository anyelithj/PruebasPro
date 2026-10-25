"""[SRP][OOP] lógica de contacto — persiste el envío y dispara los emails; no toca HTTP."""

import logging
import uuid

from src.common.enums.contact_status_enum import ContactStatus
from src.common.exceptions.not_found_exception import NotFoundException
from src.common.schemas.pagination import PaginatedResponse
from src.common.utils.pagination_util import build_page_meta, offset_of
from src.config.settings import settings
from src.infrastructure.email.email_service import EmailPayload, EmailService
from src.module.contact.dto.contact_response_dto import ContactResponseDto
from src.module.contact.dto.create_contact_dto import CreateContactDto
from src.module.contact.dto.update_contact_dto import UpdateContactDto
from src.module.contact.model.contact_submission_model import ContactSubmissionModel
from src.module.contact.repository.contact_repository import ContactRepository

logger = logging.getLogger(__name__)


class ContactService:
    def __init__(self, repository: ContactRepository, email: EmailService) -> None:
        self._repository = repository
        self._email = email

    async def submit(
        self, dto: CreateContactDto, ip_address: str | None = None
    ) -> ContactResponseDto:
        submission = ContactSubmissionModel(
            name=dto.name,
            email=str(dto.email),
            message=dto.message,
            status=ContactStatus.PENDING,
            ip_address=ip_address,
        )
        created = await self._repository.add(submission)

        # Los emails no deben tumbar el POST: si fallan, se registra y el envío sigue guardado.
        try:
            await self._notify(created)
        except Exception as exc:  # noqa: BLE001 — el envío ya está persistido.
            logger.error("Contact notification failed: %s", exc)

        return ContactResponseDto.model_validate(created)

    async def list(
        self, page: int, page_size: int, status: ContactStatus | None = None
    ) -> PaginatedResponse[ContactResponseDto]:
        items, total = await self._repository.list_page(
            offset_of(page, page_size), page_size, status
        )
        return PaginatedResponse[ContactResponseDto](
            items=[ContactResponseDto.model_validate(i) for i in items],
            meta=build_page_meta(page, page_size, total),
        )

    async def get_by_id(self, submission_id: uuid.UUID) -> ContactResponseDto:
        return ContactResponseDto.model_validate(await self._require(submission_id))

    async def update(
        self, submission_id: uuid.UUID, dto: UpdateContactDto
    ) -> ContactResponseDto:
        submission = await self._require(submission_id)
        submission.status = dto.status
        updated = await self._repository.add(submission)
        return ContactResponseDto.model_validate(updated)

    async def delete(self, submission_id: uuid.UUID) -> None:
        await self._repository.delete(await self._require(submission_id))

    async def _require(self, submission_id: uuid.UUID) -> ContactSubmissionModel:
        submission = await self._repository.get_by_id(submission_id)
        if submission is None:
            raise NotFoundException("Contact submission not found")
        return submission

    async def _notify(self, submission: ContactSubmissionModel) -> None:
        """Acuse al visitante + aviso al dueño del portfolio."""
        await self._email.send(
            EmailPayload(
                to=submission.email,
                subject="Gracias por tu mensaje",
                body=f"Hola {submission.name}, recibí tu mensaje y te respondo pronto.",
            )
        )
        await self._email.send(
            EmailPayload(
                to=settings.contact_notify_email,
                subject=f"Nuevo contacto de {submission.name}",
                body=f"{submission.email}\n\n{submission.message}",
            )
        )
