"""Motor Role-play — escenario con papel del agente y objetivos (restaurante, entrevista, aeropuerto, médico, hotel, reunión).

[Patrón]: Strategy (GameEngine) + State (objetivos pendientes → cumplidos).
[Principio]: determinístico primero — los objetivos se marcan por palabras clave, sin LLM; el LLM solo actúa el papel.
[Paradigma]: Funcional.
"""

from src.modules.assistant.domain.interfaces.game_engine import EngineMove, says
from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.message import Message


def objectives_met(ctx: GameContext, user_input: str) -> list[str]:
    """Ids de objetivos cumplidos (los anteriores + los de este turno). [Paradigma]: función pura."""
    now = {o.id for o in ctx.objectives if o.id not in ctx.met and any(says(user_input, k) for k in o.keywords)}
    return sorted(set(ctx.met) | now)


class RolePlayEngine:
    def play(self, ctx: GameContext, user_input: str, history: list[Message]) -> EngineMove:
        met = objectives_met(ctx, user_input)
        pending = [o.text for o in ctx.objectives if o.id not in met]
        done = bool(ctx.objectives) and not pending
        return EngineMove(
            llm_prompt=(
                f"Role-play. You are {ctx.role or 'a friendly local'}. Stay in character, answer in 1–2 short sentences "
                f"and keep the conversation going. Customer says: {user_input}"
                + (" Politely close the conversation." if done else "")
            ),
            fallback="Of course. Is there anything else I can help you with?",
            state={"met": met, "pending": pending, "finished": done},
        )
