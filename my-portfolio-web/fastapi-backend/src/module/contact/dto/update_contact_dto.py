"""[SRP] el admin solo mueve el estado; el contenido del envío es inmutable."""

from pydantic import BaseModel

from src.common.enums.contact_status_enum import ContactStatus


class UpdateContactDto(BaseModel):
    status: ContactStatus
