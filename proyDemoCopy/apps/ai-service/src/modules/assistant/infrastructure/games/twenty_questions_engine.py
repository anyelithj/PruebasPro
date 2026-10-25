"""Motor 20 preguntas — el agente piensa una palabra (ctx.target); el usuario pregunta sí/no o intenta adivinar.

[Patrón]: Strategy (GameEngine).
[Principio]: determinístico primero — acierto, preguntas restantes y fin de partida sin LLM; el LLM solo contesta «yes/no».
[Paradigma]: Funcional.
"""

from src.modules.assistant.domain.interfaces.game_engine import EngineMove, says
from src.modules.assistant.domain.value_objects.game_context import GameContext
from src.modules.assistant.domain.value_objects.message import Message

MAX_QUESTIONS = 20


class TwentyQuestionsEngine:
    def play(self, ctx: GameContext, user_input: str, history: list[Message]) -> EngineMove:
        secret = ctx.target or ""
        left = MAX_QUESTIONS - ctx.turn
        if secret and says(user_input, secret):  # [Acierto]: nombró la palabra secreta
            return EngineMove(reply=f"Yes! It's «{secret}». ¡Lo adivinaste en {ctx.turn} preguntas!", state={"solved": True, "finished": True})
        if left < 0:
            return EngineMove(reply=f"Se acabaron las 20 preguntas. La palabra era «{secret}».", state={"solved": False, "finished": True})
        if not user_input.strip().endswith("?"):
            return EngineMove(reply="Haz una pregunta de sí o no (termina con «?»).", state={"questions_left": left + 1})
        return EngineMove(
            llm_prompt=(
                f"You are thinking of the word '{secret}'. Answer the question about it with ONLY 'Yes', 'No' "
                f"or 'Sometimes'. Question: {user_input}"
            ),
            fallback="I'm not sure — try another question.",
            state={"questions_left": left},
        )
