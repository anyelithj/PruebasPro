"""Puerto GameEngine — motor determinista de un juego (Sprint 8.7).

[Patrón]: Port + Strategy (un motor por tipo de juego) + Value Object (EngineMove).
[Principio]: determinístico primero — el motor decide reglas, aciertos y faltas; el LLM solo redacta la jugada libre.
[Paradigma]: POO estructural (`Protocol`) + funciones puras de normalización.
"""

from dataclasses import dataclass, field
from typing import Any, Protocol

from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.message import Message
from src.shared.domain.text_norm import norm, says, words


@dataclass(frozen=True)
class EngineMove:
    """Resultado del motor: respuesta fija (sin LLM) o instrucción para que el LLM redacte la jugada."""

    reply: str | None = None  # Texto determinista → no se llama al LLM
    llm_prompt: str | None = None  # Jugada libre a redactar por el LLM
    fallback: str = ""  # Texto si el LLM no responde (la partida nunca se bloquea)
    state: dict[str, Any] = field(default_factory=dict)  # Eventos para NestJS: solved, violation, met, finished…


class GameEngine(Protocol):
    def play(self, ctx: GameContext, user_input: str, history: list[Message]) -> EngineMove: ...


# [DRY]: normalización compartida con Grading (src/shared/domain/text_norm.py); se reexporta para los motores
__all__ = ["EngineMove", "GameEngine", "norm", "says", "words"]
