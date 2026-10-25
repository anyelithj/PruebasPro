"""Value Object Message.

[Patron]: Value Object inmutable.
"""
from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class Message:
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: datetime

    @classmethod
    def user(cls, content: str) -> "Message":
        return cls(role="user", content=content, timestamp=datetime.now(UTC))

    @classmethod
    def assistant(cls, content: str) -> "Message":
        return cls(role="assistant", content=content, timestamp=datetime.now(UTC))
