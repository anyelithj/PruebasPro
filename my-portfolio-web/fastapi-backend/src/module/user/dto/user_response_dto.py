"""[ISP][SRP] shape de salida — omite password_hash del output."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserResponseDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
