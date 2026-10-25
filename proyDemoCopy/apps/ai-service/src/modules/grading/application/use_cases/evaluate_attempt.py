"""Caso de uso: evaluar la respuesta de un ítem de práctica y clasificar sus errores (Sprint 8.13, RF-112).

[Patrón]: Use Case + Strategy (un evaluador por tipo de ítem, elegido por un mapa) + Port (PracticeEvaluator).
[Principio]: SRP + OCP (tipo nuevo = evaluador nuevo) + DIP + determinístico primero.
[Paradigma]: POO + asíncrono.
[Persistencia]: ninguna — el intento lo guarda NestJS (PracticeAttempt).
"""

from typing import Protocol

from src.modules.grading.application.schemas.evaluate_request import EvaluateRequest, ItemType
from src.modules.grading.application.schemas.evaluate_response import EvaluateResponse


class PracticeEvaluator(Protocol):
    async def evaluate(self, req: EvaluateRequest) -> EvaluateResponse: ...


class EvaluateAttemptUseCase:
    def __init__(self, evaluators: dict[ItemType, PracticeEvaluator]) -> None:
        self._evaluators = evaluators

    async def execute(self, req: EvaluateRequest) -> EvaluateResponse:
        return await self._evaluators[req.item_type].evaluate(req)  # `ItemType` es Literal → Pydantic ya filtró tipos desconocidos
