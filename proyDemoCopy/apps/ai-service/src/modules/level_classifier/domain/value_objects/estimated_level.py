"""Value Object EstimatedLevel — nivel CEFR estimado, su confianza y cómo se obtuvo (Sprint 9.5, RF-126).

[Patrón]: Value Object inmutable.
[Principio]: verificación humana — es una estimación, nunca una verdad: NestJS la guarda como «estimado» hasta que un docente la confirma.
[Paradigma]: POO (`dataclass(frozen=True)`).
"""

from dataclasses import dataclass, field
from typing import Literal

CefrLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
LEVELS: tuple[CefrLevel, ...] = ("A1", "A2", "B1", "B2", "C1", "C2")
Method = Literal["measures", "rubric"]  # measures = solo indicadores · rubric = el LLM decidió un caso dudoso


@dataclass(frozen=True)
class EstimatedLevel:
    level: CefrLevel
    confidence: float  # 0–1
    method: Method
    indicators: dict[str, float] = field(default_factory=dict)
    explanation: str = ""
    model: str | None = None  # Modelo que aplicó la rúbrica (trazabilidad); None si no se llamó al LLM
