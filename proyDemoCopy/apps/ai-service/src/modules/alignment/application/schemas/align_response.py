"""Schema Pydantic v2 — respuesta de POST /alignment/align.

[Patrón]: DTO.
[Principio]: ISP — solo tiempos y confianza (el audio no se devuelve ni se guarda; NestJS guarda los tiempos en SongLine y DialogueTurn).
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel

from src.modules.alignment.application.schemas.align_request import AlignKind


class LineTimingOut(BaseModel):
    index: int
    start: float | None
    end: float | None
    confidence: float


class AlignResponse(BaseModel):
    lines: list[LineTimingOut]
    kind: AlignKind
    proposed: bool  # True en canciones: tiempos sugeridos que el docente ajusta con el editor manual
    duration: float
    model: str
