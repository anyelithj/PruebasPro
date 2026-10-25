"""[DDD] estados del ciclo de vida de un envío de contacto."""

from enum import StrEnum


class ContactStatus(StrEnum):
    PENDING = "pending"
    READ = "read"
    REPLIED = "replied"
    ARCHIVED = "archived"
