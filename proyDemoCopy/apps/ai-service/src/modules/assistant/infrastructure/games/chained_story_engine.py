"""Motor Historia encadenada — usuario y agente añaden una frase por turno usando la palabra del turno.

[Patrón]: Strategy (GameEngine).
[Principio]: determinístico primero — la palabra obligatoria del turno y la longitud mínima se validan sin LLM.
[Paradigma]: Funcional.
"""

from src.modules.assistant.domain.interfaces.game_engine import EngineMove, says, words
from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.message import Message

MIN_WORDS = 4


def word_for_turn(ctx: GameContext) -> str | None:
    """Palabra obligatoria del turno: rota sobre el vocabulario de la sesión. [Paradigma]: función pura."""
    return ctx.vocabulary[(ctx.turn - 1) % len(ctx.vocabulary)] if ctx.vocabulary else None


class ChainedStoryEngine:
    def play(self, ctx: GameContext, user_input: str, history: list[Message]) -> EngineMove:
        required = word_for_turn(ctx)
        if len(words(user_input)) < MIN_WORDS:
            return EngineMove(reply=f"Escribe una frase completa (mínimo {MIN_WORDS} palabras).", state={"accepted": False})
        if required and not says(user_input, required):
            return EngineMove(reply=f"Tu frase debe usar la palabra «{required}».", state={"accepted": False, "required": required})
        story = " ".join(m.content for m in history[-8:])  # Ventana corta de la historia (contexto del LLM)
        nxt = ctx.vocabulary[ctx.turn % len(ctx.vocabulary)] if ctx.vocabulary else None
        return EngineMove(
            llm_prompt=(
                f"We are writing a story together about: {ctx.topic or 'anything'}. Story so far: {story} {user_input}\n"
                "Continue with ONE short sentence" + (f" that uses the word '{nxt}'." if nxt else ".")
            ),
            fallback="And then something unexpected happened…",
            state={"accepted": True, "next_word": nxt},
        )
