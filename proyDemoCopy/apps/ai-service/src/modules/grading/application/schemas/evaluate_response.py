"""Schema Pydantic v2 — respuesta de POST /grading/practice.

[Patrón]: DTO.
[Principio]: DRY (los hallazgos usan ErrorFinding, el mismo formato del corrector de redacciones).
[Paradigma]: Declarativo.
"""

from typing import Literal

from pydantic import BaseModel, Field

from src.shared.domain.error_finding import ErrorFinding


class EvaluateResponse(BaseModel):
    correct: bool
    score: float = Field(..., ge=0, le=1)  # Aciertos parciales (huecos, pares, marcas)
    findings: list[ErrorFinding] = Field(default_factory=list)  # Errores con tipo, posición y corrección
    correct_answer: str  # Respuesta correcta legible (se muestra debajo del ejercicio)
    explanation: str = ""
    tip: str = ""
    method: Literal["deterministic", "semantic", "llm"] = "deterministic"
