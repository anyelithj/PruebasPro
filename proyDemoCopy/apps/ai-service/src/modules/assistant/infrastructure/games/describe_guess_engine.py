"""Motor Describe y adivina — el agente describe la palabra objetivo; el usuario adivina.

[Patrón]: Strategy (GameEngine).
[Principio]: determinístico primero — el acierto y las pistas de letras salen del motor; el LLM solo redacta la descripción.
[Paradigma]: Funcional.
"""

from src.modules.assistant.domain.interfaces.game_engine import EngineMove, says
from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.message import Message


def letter_hint(word: str, revealed: int) -> str:
    """«apple», 2 → «a p _ _ _ (5 letras)». [Paradigma]: función pura."""
    shown = " ".join(c if i < revealed else "_" for i, c in enumerate(word))
    return f"{shown} ({len(word)} letras)"


class DescribeGuessEngine:
    def play(self, ctx: GameContext, user_input: str, history: list[Message]) -> EngineMove:
        target = ctx.target or ""
        if target and says(user_input, target):
            return EngineMove(reply=f"Correct! «{target}» ✔", state={"solved": True, "finished": True})
        hint = letter_hint(target, min(ctx.turn - 1, max(len(target) - 1, 0)))  # Una letra más por turno fallado
        return EngineMove(
            llm_prompt=(
                f"Describe the word '{target}' for a language learner in ONE short sentence WITHOUT saying it. "
                + ("Give a new, different clue." if ctx.turn > 1 else "")
            ),
            fallback=f"Pista: {hint}",
            state={"solved": False, "hint": hint},
        )
