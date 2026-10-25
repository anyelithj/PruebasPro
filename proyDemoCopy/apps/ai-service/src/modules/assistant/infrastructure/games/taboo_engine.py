"""Motor Tabú / Palabra prohibida — el usuario describe la palabra objetivo sin decirla ni usar las prohibidas; el agente adivina.

[Patrón]: Strategy (GameEngine).
[Principio]: determinístico primero — las faltas se detectan sin LLM; el LLM solo propone la adivinanza.
[Paradigma]: Funcional (sin estado; todo llega en el GameContext).
"""

from src.modules.assistant.domain.interfaces.game_engine import EngineMove, says
from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.message import Message


class TabooEngine:
    def play(self, ctx: GameContext, user_input: str, history: list[Message]) -> EngineMove:
        target = ctx.target or ""
        banned = [w for w in [target, *ctx.forbidden] if w and says(user_input, w)]
        if banned:  # [Falta]: dijo la palabra o una prohibida → turno perdido, sin LLM
            return EngineMove(
                reply=f"¡Falta! Usaste una palabra prohibida: «{banned[0]}». Describe la palabra con otras palabras.",
                state={"violation": True, "banned": banned},
            )
        return EngineMove(
            llm_prompt=(
                "We are playing Taboo. Guess the single word the student is describing. "
                f"Answer with ONLY the word you guess. Description: {user_input}"
            ),
            fallback="Hmm… dame otra pista, por favor.",
            state={"violation": False, "expects_guess": True},
        )

    @staticmethod
    def solved(ctx: GameContext, guess: str) -> bool:
        """La adivinanza del agente acierta si contiene la palabra objetivo (función pura)."""
        return bool(ctx.target) and says(guess, ctx.target or "")
