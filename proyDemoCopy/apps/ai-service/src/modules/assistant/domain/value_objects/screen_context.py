"""Value Object ScreenContext — dónde está el usuario cuando pregunta al Agente Guía (Sprint 7.9).

[Patrón]: Value Object inmutable.
[Principio]: SRP — solo describe el contexto; el agente decide qué hacer con él.
[Paradigma]: POO (`dataclass(frozen=True)`).
[Seguridad]: `role` sale SIEMPRE del JWT (CurrentUser), nunca del cuerpo de la petición → nadie lee el manual de ADMIN fingiendo serlo.
"""

from dataclasses import dataclass
from typing import Literal

from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.topic_script import DialogueContext

Locale = Literal["es", "en"]
CefrLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]


@dataclass(frozen=True)
class ScreenContext:
    route: str | None  # Ruta del portal («/courses», «/checkout»…) → «en esta pantalla…»
    role: str  # USER | TEACHER | ADMIN (del token)
    locale: Locale = "es"  # Idioma de la interfaz (FAQ y manual existen en ES y EN)
    level: CefrLevel | None = None  # [Sprint 7.8]: nivel MCER que declara el alumno → el tutor ajusta vocabulario y ejemplos
    game: GameContext | None = None  # [Sprint 8.7]: partida que envía NestJS (solo la persona «game» lo lee)
    dialogue: DialogueContext | None = None  # [Sprint 9.6]: tema de la conversación con el avatar (persona «dialogue»)
