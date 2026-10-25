"""[ISP][SRP] shape de salida del proyecto."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProjectResponseDto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    slug: str
    description: str
    link: str
    techs: list[str]
    featured: bool
    created_at: datetime
    updated_at: datetime
