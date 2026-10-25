"""Port de Strategy para modelos de calificacion.

[Patron]: Strategy + Port (Hexagonal).
[Principio]: DIP + OCP + ISP.
[Paradigma]: POO + tipos protocolos.
"""
from typing import Protocol

from src.modules.grading.application.schemas.grading_request import GradingRequest


class GradingModel(Protocol):
    """Contrato comun de cualquier estrategia de calificacion."""

    name: str

    async def grade(
        self, request: GradingRequest
    ) -> tuple[float, bool, float]:
        """Califica y devuelve (score 0..1, is_correct, confidence 0..1).

        [Principio]: SRP — solo califica, no persiste ni emite eventos.
        """
        ...
