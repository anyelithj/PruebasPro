"""GameAgent — persona «game»: delega en el motor del juego y usa el LLM solo para la jugada libre (Sprint 8.7, RF-100/101).

[Patrón]: Adapter (puerto Agent) + Strategy (motor por tipo de juego) + Template Method (motor → LLM → respaldo).
[Principio]: determinístico primero + DIP (motores y LLM inyectados) + OCP (juego nuevo = motor nuevo en el mapa).
[Paradigma]: POO + asíncrono.
"""

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.agent import AgentReply
from src.modules.assistant.domain.interfaces.game_engine import GameEngine
from src.modules.assistant.domain.value_objects.game_context import GameType
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.infrastructure.games.chained_story_engine import ChainedStoryEngine
from src.modules.assistant.infrastructure.games.debate_engine import DebateEngine
from src.modules.assistant.infrastructure.games.describe_guess_engine import DescribeGuessEngine
from src.modules.assistant.infrastructure.games.role_play_engine import RolePlayEngine
from src.modules.assistant.infrastructure.games.taboo_engine import TabooEngine
from src.modules.assistant.infrastructure.games.twenty_questions_engine import TwentyQuestionsEngine
from src.modules.feedback.domain.interfaces.llm_client import LLMClient
from src.shared.clients.llm_json import generate_json

_LANG = {"en": "English", "fr": "French", "de": "German", "es": "Spanish", "pt": "Portuguese", "zh": "Mandarin Chinese", "ru": "Russian"}
_SYSTEM = (
    "You are a game partner for a language learner. Be brief, friendly and stay inside the game rules. "
    'Return ONLY JSON: {"reply": "<your move>"}.'
)

ENGINES: dict[GameType, GameEngine] = {
    "taboo": TabooEngine(),
    "twenty_questions": TwentyQuestionsEngine(),
    "describe_guess": DescribeGuessEngine(),
    "chained_story": ChainedStoryEngine(),
    "debate": DebateEngine(),
    "role_play": RolePlayEngine(),
}


class GameAgent:
    def __init__(self, llm: LLMClient, engines: dict[GameType, GameEngine] = ENGINES) -> None:
        self._llm = llm
        self._engines = engines

    async def reply(
        self, conversation: Conversation, user_input: str, language: str | None = None, context: ScreenContext | None = None
    ) -> AgentReply:
        ctx = context.game if context else None
        if ctx is None:  # Persona «game» sin partida → mensaje fijo (NestJS siempre envía el contexto)
            return AgentReply("Inicia una partida desde el catálogo de juegos.", answered_by="none")
        move = self._engines[ctx.game].play(ctx, user_input, conversation.last_n(10))
        if move.reply is not None:  # [Determinístico]: el motor resolvió el turno sin LLM
            return AgentReply(move.reply, answered_by="engine", game_state=move.state)

        level = f" (CEFR level {context.level})" if context and context.level else ""
        prompt = f"Reply in {_LANG.get(language or 'en', 'English')}{level}.\n{move.llm_prompt}"
        data = await generate_json(self._llm, prompt, system=_SYSTEM, max_tokens=120, temperature=0.6)
        text = str((data or {}).get("reply", "")).strip() or move.fallback  # LLM caído o sin JSON → respaldo del motor
        state = dict(move.state)
        if ctx.game == "taboo":  # El acierto del agente también lo decide el motor (no el LLM)
            state["solved"] = TabooEngine.solved(ctx, text)
        return AgentReply(text, answered_by="llm", game_state=state)
