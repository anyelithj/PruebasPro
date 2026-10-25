"""Schema Pydantic v2 — respuesta de POST /level-classifier/classify.

[Patrón]: DTO.
[Principio]: transparencia — devuelve los indicadores medidos y el método para que el docente vea por qué y decida.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel

from src.modules.level_classifier.domain.value_objects.estimated_level import CefrLevel, Method


class ClassifyResponse(BaseModel):
    level: CefrLevel
    confidence: float
    method: Method
    indicators: dict[str, float]
    explanation: str
    model: str | None = None
    estimated: bool = True  # Siempre True: el nivel lo confirma un docente en NestJS (PATCH /dialogues/:id/level)
