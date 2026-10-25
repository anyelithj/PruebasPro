"""Value Object Confidence — certeza del modelo en su decision.

[Patron]: Value Object inmutable.
[Principio]: SRP.
"""
from dataclasses import dataclass

from src.shared.exceptions.custom_errors import ValidationDomainError


@dataclass(frozen=True)
class Confidence:
    """Confianza del modelo en [0, 1]. < 0.5 = baja, requeriria revision humana."""

    value: float

    def __post_init__(self) -> None:
        if not (0.0 <= self.value <= 1.0):
            raise ValidationDomainError(f"Confidence out of range: {self.value}")

    @property
    def is_high(self) -> bool:
        return self.value >= 0.75

    @property
    def is_low(self) -> bool:
        return self.value < 0.5
