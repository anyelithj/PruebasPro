"""Schemas Pydantic v2 — respuestas de /analytics.

[Patrón]: DTO inmutable.
[Principio]: ISP (cada endpoint su respuesta).
[Paradigma]: Declarativo.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict

Level = Literal["easy", "medium", "hard"]


class DifficultyItem(BaseModel):
    model_config = ConfigDict(frozen=True)
    question_id: str
    original: Level
    new_label: Level  # Dificultad calculada con datos reales
    confidence: float
    attempts: int
    error_rate: float
    mismatch: bool  # True → la dificultad declarada no coincide con los datos


class DifficultyResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    method: Literal[
        "kmeans", "threshold"
    ]  # Trazabilidad: modelo o respaldo determinista
    questions: list[DifficultyItem]
    mismatches: int


class AnomalyItem(BaseModel):
    model_config = ConfigDict(frozen=True)
    question_id: str
    score: float
    error_rate: float
    avg_time_ms: float
    reason: str


class AnomalyResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    analyzed: int
    anomalies: list[AnomalyItem]
