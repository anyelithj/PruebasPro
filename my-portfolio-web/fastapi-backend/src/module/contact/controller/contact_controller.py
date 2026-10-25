"""[MVC-C][SRP] capa HTTP de contacto — solo delega al service, sin lógica."""

import uuid

from src.common.dependencies.db_dependency import DbSession
from src.common.enums.contact_status_enum import ContactStatus
from src.common.schemas.api_response import ApiResponse
from src.common.schemas.pagination import PaginatedResponse
from src.infrastructure.email.email_service import EmailService
from src.module.contact.dto.contact_response_dto import ContactResponseDto
from src.module.contact.dto.create_contact_dto import CreateContactDto
from src.module.contact.dto.update_contact_dto import UpdateContactDto
from src.module.contact.repository.contact_repository import ContactRepository
from src.module.contact.service.contact_service import ContactService


def get_contact_service(session: DbSession) -> ContactService:
    """[DI] compone repository + email → service para cada request."""
    return ContactService(ContactRepository(session), EmailService())


class ContactController:
    """Métodos delgados: reciben service ya inyectado, devuelven ApiResponse."""

    @staticmethod
    async def submit(
        service: ContactService, dto: CreateContactDto, ip_address: str | None
    ) -> ApiResponse[ContactResponseDto]:
        return ApiResponse.ok(await service.submit(dto, ip_address), "Contact submitted")

    @staticmethod
    async def list(
        service: ContactService, page: int, page_size: int, status: ContactStatus | None
    ) -> ApiResponse[PaginatedResponse[ContactResponseDto]]:
        return ApiResponse.ok(await service.list(page, page_size, status))

    @staticmethod
    async def get(
        service: ContactService, submission_id: uuid.UUID
    ) -> ApiResponse[ContactResponseDto]:
        return ApiResponse.ok(await service.get_by_id(submission_id))

    @staticmethod
    async def update(
        service: ContactService, submission_id: uuid.UUID, dto: UpdateContactDto
    ) -> ApiResponse[ContactResponseDto]:
        return ApiResponse.ok(await service.update(submission_id, dto), "Contact updated")

    @staticmethod
    async def delete(service: ContactService, submission_id: uuid.UUID) -> ApiResponse[None]:
        await service.delete(submission_id)
        return ApiResponse.ok(None, "Contact submission deleted")
