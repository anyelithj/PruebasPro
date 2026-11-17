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
    """Cita de la respuesta (FAQ, sección del manual o fragmento del temario) | [Sprint 7.9] · [Tarea 9]: «curriculum» = RAG del tutor."""

    model_config = ConfigDict(frozen=True)
    kind: Literal["faq", "manual", "curriculum"]
    id: str
    title: str
    ref: str | None = None


class LanguageUsageOut(BaseModel):
    """Uso del idioma meta del alumno en la conversación (2026-10-28) → UI «Uso del idioma: 45 % / meta 60 %»."""

    model_config = ConfigDict(frozen=True)
    language: str
    level: str
    ratio: float  # 0–1 · palabras en el idioma meta / palabras contadas
    target: float  # 0–1 · meta del nivel (TARGET_SHARE_BY_LEVEL)
    words: int
    target_words: int
    turns: int  # Mensajes del alumno que cuentan (posteriores al aviso del tutor)
    announced: bool  # ¿El tutor ya indicó cuándo escribir en el idioma meta?
    below: bool  # ¿Va por debajo de la meta?


class ChatResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    session_id: str
    reply: str
    history: list[ChatTurn]
    sources: list[SourceOut] = []  # [Sprint 7.9] · [Tarea 9]: el tutor devuelve los fragmentos del temario que usó (RNF-35)
    answered_by: Literal["faq", "manual", "llm", "engine", "none"] = "llm"
    game: dict[str, Any] | None = None  # [Sprint 8.7]: estado de la partida (solved, violation, met, finished…)
    dialogue: dict[str, Any] | None = None  # [Sprint 9.6]: vocabulario del tema usado y corrección suave del avatar
    language_usage: LanguageUsageOut | None = None  # [2026-10-28]: solo el tutor con idioma meta ≠ español
