"""[DRY][SRP] UUIDParam reutilizable para validar identificadores de ruta."""

import uuid

from pydantic import BaseModel


class UUIDParam(BaseModel):
    id: uuid.UUID
