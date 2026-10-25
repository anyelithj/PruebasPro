"""Value Object GameContext — estado de la partida que envía NestJS en cada turno (Sprint 8.7).

[Patrón]: Value Object inmutable (Pydantic frozen) — la partida vive en NestJS (GameSession/GameRound); aquí solo se lee.
[Principio]: SRP + sin estado en FastAPI (cualquier réplica atiende cualquier turno).
[Paradigma]: Declarativo.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GameType = Literal["taboo", "twenty_questions", "describe_guess", "chained_story", "debate", "role_play"]


class Objective(BaseModel):
    """Objetivo de un escenario de role-play: se cumple si el usuario dice alguna de sus palabras clave."""

    model_config = ConfigDict(frozen=True)
    id: str
    text: str
    keywords: list[str] = Field(default_factory=list, max_length=12)


class GameContext(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    game: GameType
    turn: int = Field(default=1, ge=1, le=100)  # Turno actual (lo lleva NestJS)
    max_turns: int = Field(default=20, ge=1, le=100)
    target: str | None = Field(default=None, max_length=80)  # Palabra a describir o a adivinar
    forbidden: list[str] = Field(default_factory=list, max_length=10)  # Tabú: palabras prohibidas
    topic: str | None = Field(default=None, max_length=200)  # Debate, historia o tema aleatorio
    vocabulary: list[str] = Field(default_factory=list, max_length=40)  # Vocabulario de la sesión
    role: str | None = Field(default=None, max_length=120)  # Role-play: papel del agente (camarero, entrevistador…)
    objectives: list[Objective] = Field(default_factory=list, max_length=8)
    met: list[str] = Field(default_factory=list, max_length=8)  # Objetivos ya cumplidos en turnos anteriores
