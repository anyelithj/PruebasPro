"""[CC-N] valores semánticos de rol, no strings mágicos."""

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    USER = "user"
