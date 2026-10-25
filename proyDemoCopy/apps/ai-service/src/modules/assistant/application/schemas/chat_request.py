"""Schema chat request.

[Patron]: DTO + Pydantic.
[Principio]: SRP + ISP.
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.persona import Persona
from src.modules.assistant.domain.value_objects.screen_context import CefrLevel, Locale
from src.modules.assistant.domain.value_objects.topic_script import DialogueContext


class ChatRequest(BaseModel):
    """Mensaje del usuario al asistente tutor."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    session_id: str | None = None  # null = nueva conversacion
    message: str = Field(..., min_length=1, max_length=2000)
    # [Contexto opcional]: el frontend puede pasar topic / quiz_id para enfocar al tutor
    topic: str | None = None
    # [Sprint 5.3]: idioma que estudia el alumno → filtra el material del RAG y orienta los ejemplos
    language: Literal["en", "fr", "de", "es", "pt", "zh", "ru"] | None = None
    # [Sprint 7.8]: nivel MCER del alumno → el tutor gradúa la dificultad (y la UI se tiñe con su color)
    level: CefrLevel | None = None
    # [Sprint 7.9]: persona que responde (tutor | guide) + contexto de pantalla del Agente Guía (el rol sale del JWT, no de aquí)
    persona: Persona = "tutor"
    route: str | None = Field(None, max_length=200, pattern=r"^/[\w\-/]*$")  # Solo rutas internas del portal
    locale: Locale = "es"
    # [Sprint 8.7]: partida en curso (persona «game»); la envía NestJS Games en cada turno
    game: GameContext | None = None
    # [Sprint 9.6]: tema de la conversación con el avatar (persona «dialogue»); lo envía NestJS Dialogues
    dialogue: DialogueContext | None = None
