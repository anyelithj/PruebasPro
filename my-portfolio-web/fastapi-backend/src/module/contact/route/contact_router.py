"""[SRP] APIRouter(prefix="/contact") — POST público, bandeja y gestión solo admin."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status

from src.common.constants.roles_constants import ROLE_ADMIN
from src.common.dependencies.auth_dependency import require_roles
from src.common.enums.contact_status_enum import ContactStatus
from src.common.schemas.api_response import ApiResponse
from src.common.schemas.pagination import PaginatedResponse
from src.module.contact.controller.contact_controller import (
    ContactController,
    get_contact_service,
)
from src.module.contact.dto.contact_response_dto import ContactResponseDto
from src.module.contact.dto.create_contact_dto import CreateContactDto
from src.module.contact.dto.update_contact_dto import UpdateContactDto
from src.module.contact.service.contact_service import ContactService

router = APIRouter(prefix="/contact", tags=["contact"])

ServiceDep = Annotated[ContactService, Depends(get_contact_service)]


@router.post(
    "",
    response_model=ApiResponse[ContactResponseDto],
    status_code=status.HTTP_201_CREATED,
)
async def submit_contact(
    service: ServiceDep, dto: CreateContactDto, request: Request
) -> ApiResponse[ContactResponseDto]:
    ip = request.client.host if request.client else None
    return await ContactController.submit(service, dto, ip)


@router.get("", response_model=ApiResponse[PaginatedResponse[ContactResponseDto]])
async def list_contacts(
    service: ServiceDep,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    contact_status: ContactStatus | None = None,
) -> ApiResponse[PaginatedResponse[ContactResponseDto]]:
    return await ContactController.list(service, page, page_size, contact_status)


@router.get("/{submission_id}", response_model=ApiResponse[ContactResponseDto])
async def get_contact(
    service: ServiceDep,
    submission_id: uuid.UUID,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[ContactResponseDto]:
    return await ContactController.get(service, submission_id)


@router.patch("/{submission_id}", response_model=ApiResponse[ContactResponseDto])
async def update_contact(
    service: ServiceDep,
    submission_id: uuid.UUID,
    dto: UpdateContactDto,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[ContactResponseDto]:
    return await ContactController.update(service, submission_id, dto)


@router.delete("/{submission_id}", response_model=ApiResponse[None])
async def delete_contact(
    service: ServiceDep,
    submission_id: uuid.UUID,
    _: Annotated[object, Depends(require_roles(ROLE_ADMIN))],
) -> ApiResponse[None]:
    return await ContactController.delete(service, submission_id)
