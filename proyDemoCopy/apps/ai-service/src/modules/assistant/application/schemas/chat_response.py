"""Schema chat response.

[Patron]: DTO + Pydantic.
"""
from datetime import datetime

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class ChatTurn(BaseModel):
    model_config = ConfigDict(frozen=True)
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime


class SourceOut(BaseModel):
    """Cita de la respuesta (FAQ o sección del manual) | [Sprint 7.9]."""

    model_config = ConfigDict(frozen=True)
    kind: Literal["faq", "manual"]
    id: str
    title: str
    ref: str | None = None


class ChatResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    session_id: str
    reply: str
    history: list[ChatTurn]
    sources: list[SourceOut] = []  # [Sprint 7.9]: vacía para el tutor
    answered_by: Literal["faq", "manual", "llm", "engine", "none"] = "llm"
    game: dict[str, Any] | None = None  # [Sprint 8.7]: estado de la partida (solved, violation, met, finished…)
    dialogue: dict[str, Any] | None = None  # [Sprint 9.6]: vocabulario del tema usado y corrección suave del avatar
