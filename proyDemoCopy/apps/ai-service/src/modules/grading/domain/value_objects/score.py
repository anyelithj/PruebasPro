"""Value Object Score normalizado 0..1.

[Patron]: Value Object inmutable.
[Principio]: SRP + LSP.
[Paradigma]: POO + dataclass frozen.
"""
from dataclasses import dataclass

from src.shared.exceptions.custom_errors import ValidationDomainError


@dataclass(frozen=True)
class Score:
    """Score normalizado en [0, 1]."""

    value: float

    def __post_init__(self) -> None:
        if not (0.0 <= self.value <= 1.0):
            raise ValidationDomainError(f"Score out of range: {self.value}")

    @classmethod
    def perfect(cls) -> "Score":
        return cls(1.0)

    @classmethod
    def zero(cls) -> "Score":
        return cls(0.0)
