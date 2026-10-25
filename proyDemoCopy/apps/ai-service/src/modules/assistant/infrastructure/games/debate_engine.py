"""Motor Debate rápido — el usuario defiende una postura; el agente contraargumenta.

[Patrón]: Strategy (GameEngine).
[Principio]: determinístico primero — longitud mínima, conectores usados y fin de partida sin LLM.
[Paradigma]: Funcional.
"""

from src.modules.assistant.domain.interfaces.game_engine import EngineMove, says, words
from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.message import Message

MIN_WORDS = 8
# Conectores argumentativos (inglés por defecto; el feedback premia usarlos)
CONNECTORS = ("because", "however", "therefore", "although", "for example", "in my opinion", "on the other hand")


class DebateEngine:
    def play(self, ctx: GameContext, user_input: str, history: list[Message]) -> EngineMove:
        if ctx.turn > ctx.max_turns:
            return EngineMove(reply="¡Fin del debate! Revisa tus métricas de fluidez.", state={"finished": True})
        if len(words(user_input)) < MIN_WORDS:
            return EngineMove(reply=f"Desarrolla tu argumento (mínimo {MIN_WORDS} palabras).", state={"accepted": False})
        used = [c for c in CONNECTORS if says(user_input, c)]
        return EngineMove(
            llm_prompt=(
                f"Debate topic: {ctx.topic}. The student argues: {user_input}\n"
                "Reply with ONE short, polite counter-argument (max 2 sentences) and end with a question."
            ),
            fallback="That's a fair point, but have you considered the opposite view? Why?",
            state={"accepted": True, "connectors": used},
        )
