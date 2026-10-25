"""[ISP][SRP] shape de salida del envío de contacto."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from src.common.enums.contact_status_enum import ContactStatus


class ContactResponseDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    message: str
    status: ContactStatus
    ip_address: str | None
    created_at: datetime
    updated_at: datetime
