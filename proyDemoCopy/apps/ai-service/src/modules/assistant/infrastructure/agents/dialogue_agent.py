"""DialogueAgent — persona «dialogue»: el avatar conversa sobre un tema, en un idioma y a un nivel (Sprint 9.6, RF-122).

[Patrón]: Adapter (puerto Agent) + Template Method (apertura determinista → LLM dentro del tema → respaldo fijo).
[Principio]: determinístico primero (apertura y vocabulario usado sin LLM) + DIP (LLM inyectado) + SRP.
[Paradigma]: POO + asíncrono.
[Pedagogía]: correcciones suaves (recast): el avatar responde con la forma correcta sin interrumpir; la corrección va aparte para la UI.
"""

from difflib import SequenceMatcher

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.agent import AgentReply
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.domain.value_objects.topic_script import CLOSINGS, FAREWELLS, FOLLOW_UP, FOLLOW_UPS, DialogueContext, opening, opening_es
from src.modules.feedback.domain.interfaces.llm_client import LLMClient
from src.shared.clients.llm_json import generate_json
from src.shared.domain.text_norm import drifted_to_spanish, norm, says, words

_LANG = {"en": "English", "fr": "French", "de": "German", "es": "Spanish", "pt": "Portuguese", "zh": "Mandarin Chinese", "ru": "Russian"}
_SYSTEM = (
    "You are Aula, a friendly avatar who chats with a language learner. Speak ONLY in the target language, "
    "use vocabulary and grammar of the learner's CEFR level, stay on the topic, reply in 1–2 short sentences and end with a question. "
    "React to what the learner JUST said (details, names, reasons) and ask a NEW question; never repeat a question you already asked. "
    "If the learner made a clear mistake, reuse the correct form naturally in your reply and put a short explanation in Spanish in "
    '"correction"; otherwise "correction" is null. Put the Spanish translation of your reply in "translation" '
    "and the Spanish translation of the learner's last message in \"learner_translation\". "
    'Return ONLY JSON: {"reply": "...", "translation": "...", "learner_translation": "...", "correction": "..." | null}.'
)
START = "__start__"  # Marca que envía NestJS al iniciar la sesión: el avatar abre la conversación


class DialogueAgent:
    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    async def reply(
        self, conversation: Conversation, user_input: str, language: str | None = None, context: ScreenContext | None = None
    ) -> AgentReply:
        ctx = context.dialogue if context else None
        lang = language or "en"
        if ctx is None:  # Persona «dialogue» sin tema → mensaje fijo (NestJS siempre envía el contexto)
            return AgentReply("Elige un tema de conversación para empezar.", answered_by="none")
        if user_input.strip() == START:  # [Determinístico]: apertura por tema e idioma, sin LLM
            # [2026-10-23]: la apertura semilla ya trae su traducción española (antes el primer turno quedaba con «—»)
            return AgentReply(opening(ctx, lang), answered_by="engine", game_state={"vocabulary_used": [], "correction": None, "translation": opening_es(ctx, lang)})

        used = [w for w in ctx.vocabulary if says(user_input, w)]  # Vocabulario clave del tema que el usuario usó (sin LLM)
        if says_goodbye(user_input, lang):  # [2026-10-23]: despedida → cierre determinista y `finished` (NestJS termina la sesión)
            return AgentReply(
                CLOSINGS.get(lang, CLOSINGS["en"]),
                answered_by="engine",
                game_state={"vocabulary_used": used, "correction": None, "translation": None if lang == "es" else CLOSINGS["es"], "finished": True},
            )
        level = context.level if context and context.level else "A2"
        # [Historial sin el turno actual]: el caso de uso ya añadió el mensaje del usuario → va aparte como «Learner:» (antes salía duplicado)
        past = [m for m in conversation.last_n(9)[:-1] if m.content != START]
        history = "\n".join(f"{'Aula' if m.role == 'assistant' else 'Learner'}: {m.content}" for m in past) or "(start)"
        asked = {norm(m.content) for m in past if m.role == "assistant"}  # Lo que el avatar ya dijo → nunca se repite
        prompt = (
            f"Target language: {_LANG.get(lang, 'English')}. Learner level: {level}. Topic: {ctx.title}.\n"
            f"Goals: {'; '.join(ctx.objectives) or 'keep the chat going'}. Key words: {', '.join(ctx.vocabulary[:15])}.\n"
            f"Conversation so far:\n{history}\nLearner: {user_input}"
        )
        data = await generate_json(self._llm, prompt, system=_SYSTEM, max_tokens=220, temperature=0.6)
        text = str((data or {}).get("reply", "")).strip()
        # [Guarda de idioma]: modelos pequeños a veces responden en español → un reintento con la orden explícita; si insiste, pregunta de respaldo
        # [Guarda de repetición · 2026-10-20]: si repite una frase suya (el bucle «Interesting! Can you tell me a bit more?») → reintento pidiendo otra pregunta
        if drifted_to_spanish(text, lang) or (text and _repeats(text, asked)):
            hint = "answer in " + _LANG.get(lang, "English") + ", never in Spanish" if drifted_to_spanish(text, lang) else "ask a different, new question about what the learner said"
            retry = await generate_json(self._llm, f"{prompt}\nIMPORTANT: {hint}.", system=_SYSTEM, max_tokens=220, temperature=0.8)
            data = retry or data
            text = str((retry or {}).get("reply", "")).strip()
            text = "" if drifted_to_spanish(text, lang) or _repeats(text, asked) else text
        elif data is None:  # [JSON inválido o LLM lento]: un intento en texto plano antes del respaldo fijo
            text = await self._plain(prompt, lang, asked)
        correction = (data or {}).get("correction")
        translation = str((data or {}).get("translation") or "").strip() if text else ""
        by = "llm" if text else "engine"
        if not text:  # LLM caído → pregunta que aún no se hizo (la conversación nunca se bloquea ni se repite) + su traducción fija
            text, translation = self._follow_up(lang, asked, ctx)
        return AgentReply(
            text,
            answered_by=by,
            game_state={
                "vocabulary_used": used,
                "correction": str(correction).strip() if correction else None,
                "translation": translation or None,  # [2026-10-20]: traducción al español del propio avatar (NestJS la usa si LanguageTools no traduce)
                # [2026-10-23]: traducción del mensaje del alumno en la misma llamada → su turno tampoco queda con «—»
                "learner_translation": str((data or {}).get("learner_translation") or "").strip() or None,
            },
        )

    async def _plain(self, prompt: str, lang: str, asked: set[str]) -> str:
        """Respaldo sin JSON: primera línea de una respuesta en texto (descarta español, repeticiones y el texto fijo del cliente caído)."""
        try:
            raw = await self._llm.generate(f"{prompt}\nReply in {_LANG.get(lang, 'English')} with 1-2 sentences only.", max_tokens=120, temperature=0.7)
        except Exception:  # noqa: BLE001 — LLM caído: decide el respaldo determinista
            return ""
        line = next((x.strip().strip('"') for x in raw.splitlines() if x.strip()), "").removeprefix("Aula:").strip()
        bad = not line or line.startswith("{") or line.startswith("Revisa el concepto") or drifted_to_spanish(line, lang) or _repeats(line, asked)
        return "" if bad else line

    @staticmethod
    def _follow_up(lang: str, asked: set[str], ctx: DialogueContext) -> tuple[str, str]:
        """Primera pregunta de respaldo que el avatar aún no dijo + su traducción; agotadas → una con una palabra clave del tema. [Paradigma]: función pura."""
        options = FOLLOW_UPS.get(lang, FOLLOW_UPS["en"])
        # `zip` (Python): cada pregunta con su traducción española (mismo orden en FOLLOW_UPS["es"])
        fresh = next(((q, es) for q, es in zip(options, FOLLOW_UPS["es"], strict=True) if norm(q) not in asked), None)
        if fresh:
            return fresh
        said = " ".join(asked)
        word = next((w for w in ctx.vocabulary if norm(w) not in said), ctx.title)
        return f"{word}? {FOLLOW_UP.get(lang, FOLLOW_UP['en'])}", f"¿{word}? {FOLLOW_UP['es']}"


def says_goodbye(text: str, lang: str) -> bool:
    """¿El alumno se despide al FINAL de su mensaje? («The cheese is mild…; goodbye.») — en su idioma de práctica o en español.

    Solo cuentan las 4 últimas palabras → «How do you say goodbye in French?» no cierra la charla. [Paradigma]: función pura.
    """
    options = FAREWELLS.get(lang, ()) + FAREWELLS["es"]
    if lang == "zh":  # Sin espacios entre palabras → basta con que la despedida esté en el final del texto
        return any(f in text.strip()[-8:] for f in options)
    tail = " ".join(words(text)[-4:])
    return any(says(tail, f) for f in options)


def _repeats(text: str, asked: set[str]) -> bool:
    """¿La frase repite (o casi) algo que el avatar ya dijo? [2026-10-23]: «Great! What ingredients…» ≈ «That sounds yummy! What ingredients…».

    `SequenceMatcher.ratio` (difflib, stdlib): similitud 0–1 entre textos normalizados; ≥ 0.75 o misma pregunta final = repetición.
    """
    t = norm(text)
    tail = t.rsplit("!", 1)[-1].strip()  # La pregunta tras la exclamación inicial («Great!», «Interesting!»)
    return any(t == a or SequenceMatcher(None, t, a).ratio() >= 0.75 or (len(tail) > 12 and tail in a) for a in asked)
