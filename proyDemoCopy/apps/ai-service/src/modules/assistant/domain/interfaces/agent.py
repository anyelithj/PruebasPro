"""Puerto del agente conversacional.

[Patrón]: Port (Hexagonal) + Strategy (cualquier agente que responda a una conversación).
[Principio]: DIP + ISP.
[Paradigma]: POO estructural (`Protocol`) + Value Objects (`dataclass(frozen=True)`).
[Sprint 7.9]: la respuesta lleva sus fuentes y quién respondió (faq | manual | llm | none) → el Agente Guía cita la sección y la UI lo muestra.
"""

from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext

AnsweredBy = Literal["faq", "manual", "llm", "engine", "none"]  # [Sprint 8.7]: «engine» = motor determinista del juego


@dataclass(frozen=True)
class Source:
    """Cita de una respuesta: FAQ o sección del manual (trazabilidad: de dónde salió)."""

    kind: Literal["faq", "manual"]
    id: str  # Id de la FAQ o «slug#sección» del manual
    title: str  # Pregunta de la FAQ o título de la sección
    ref: str | None = None  # Artículo del manual al que enlaza (slug), si hay


@dataclass(frozen=True)
class AgentReply:
    text: str
    sources: list[Source] = field(default_factory=list)
    answered_by: AnsweredBy = "llm"
    game_state: dict[str, Any] | None = None  # [Sprint 8.7]: eventos de la partida (acierto, falta, objetivos) para NestJS


class Agent(Protocol):
    async def reply(
        self,
        conversation: Conversation,
        user_input: str,
        language: str | None = None,
        context: ScreenContext | None = None,
    ) -> AgentReply: ...
