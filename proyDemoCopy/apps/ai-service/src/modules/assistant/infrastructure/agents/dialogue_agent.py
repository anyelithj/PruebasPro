"""DialogueAgent — persona «dialogue»: el avatar conversa sobre un tema, en un idioma y a un nivel (Sprint 9.6, RF-122).

[Patrón]: Adapter (puerto Agent) + Template Method (apertura determinista → LLM dentro del tema → respaldo fijo).
[Principio]: determinístico primero (apertura y vocabulario usado sin LLM) + DIP (LLM inyectado) + SRP.
[Paradigma]: POO + asíncrono.
[Pedagogía]: correcciones suaves (recast): el avatar responde con la forma correcta sin interrumpir; la corrección va aparte para la UI.
[2026-10-25]: JSON corto (solo «reply» + «correction»), lector tolerante de claves, reparación del artículo español inicial,
un reintento en texto plano dentro de un presupuesto de tiempo y respaldo contextual rotado por turno (ver _follow_up).
"""

import logging
import time
from difflib import SequenceMatcher
from typing import Any

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.agent import AgentReply
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.domain.value_objects.topic_script import CLOSINGS, FAREWELLS, FOCUS_FOLLOW_UPS, FOLLOW_UP, FOLLOW_UPS, DialogueContext, opening, opening_es
from src.modules.feedback.domain.interfaces.llm_client import LLMClient
from src.shared.clients.llm_json import generate_json
from src.shared.domain.llm_output import loads_lenient, parse_translation
from src.shared.domain.text_norm import SPANISH_LEAD, drifted_to_spanish, norm, says, words

logger = logging.getLogger("ai-service.dialogue-agent")  # `logging.getLogger`: el motivo de cada respaldo queda en los logs (diagnóstico)

_LANG = {"en": "English", "fr": "French", "de": "German", "es": "Spanish", "pt": "Portuguese", "zh": "Mandarin Chinese", "ru": "Russian"}
# [2026-10-25 · Causa raíz del respaldo fijo]: antes el JSON pedía además «translation» y «learner_translation» (dos textos en
# español) con max_tokens=220 → en CPU tardaba más (timeout de Ollama → texto «Revisa el concepto…» → JSON inválido) o se cortaba
# (JSON truncado = inválido) y mezclaba español en la respuesta («El rooster's beak…»). Ahora solo «reply» y «correction»;
# la traducción la hace LanguageTools /lines (una sola fuente, validada) | [Principio]: SRP + DRY.
_SYSTEM = (
    "You are Aula, a friendly avatar who chats with a language learner. Write the reply ONLY in the target language: "
    "never use Spanish words or Spanish articles (el, la, los, las) in it, even if the learner mixes Spanish. "
    "Use the usual target-language name of dishes and things (a learner's literal «rooster's beak» is «pico de gallo»). "
    "Use vocabulary and grammar of the learner's CEFR level, stay on the topic, reply in 1–2 short sentences and end with a question. "
    "React to what the learner JUST said (details, names, reasons) and ask a NEW question; never repeat a question you already asked. "
    "If the learner made a clear mistake, reuse the correct form naturally in your reply and put a short explanation in Spanish in "
    '"correction"; otherwise "correction" is null. Return ONLY JSON: {"reply": "...", "correction": "..." | null}.'
)
START = "__start__"  # Marca que envía NestJS al iniciar la sesión: el avatar abre la conversación
_REPLY_KEYS = ("reply", "response", "answer", "message", "text", "aula")  # Claves donde un modelo pequeño deja la respuesta
_HINTS = {  # Orden extra del reintento según el problema detectado
    "spanish": "answer in {lang} only, never in Spanish (no Spanish words or articles)",
    "repeat": "ask a different, new question about what the learner said",
    "empty": "reply in {lang} with 1-2 short sentences and a question",
}
# [Presupuesto]: NestJS espera 90 s; si el primer intento ya tardó más que esto, no hay tiempo para otro → respaldo inmediato
RETRY_BUDGET_S = 35.0


class DialogueAgent:
    def __init__(self, llm: LLMClient, retry_budget_s: float = RETRY_BUDGET_S) -> None:
        self._llm = llm
        self._retry_budget_s = retry_budget_s  # [DI]: los tests pueden ajustarlo

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
        began = time.monotonic()  # `time.monotonic` (stdlib): reloj que no salta con cambios de hora → mide la latencia del LLM
        data = await generate_json(self._llm, prompt, system=_SYSTEM, max_tokens=160, temperature=0.6)
        first = text = _fix_spanish_lead(reply_text(data), lang)  # [Reparación barata]: «El rooster's beak…» → «The rooster's beak…» sin otra llamada
        problem = _problem(text, lang, asked)
        if problem and time.monotonic() - began < self._retry_budget_s:
            # [Reintento único en texto plano]: sin JSON no hay JSON inválido ni truncado; con la orden concreta del problema
            hint = _HINTS[problem].format(lang=_LANG.get(lang, "English"))
            text = await self._plain(f"{prompt}\nIMPORTANT: {hint}.", lang, asked)
            problem = _problem(text, lang, asked)
        if problem:
            text = ""
        correction = (data or {}).get("correction")
        # Si el modelo tradujo igual (sin pedírselo) y es la misma respuesta del primer intento, se limpia y se usa de respaldo
        translation = parse_translation((data or {}).get("translation"), text) if text and text == first else None
        by = "llm" if text else "engine"
        if not text:  # LLM caído o insistente → pregunta de respaldo contextual que aún no se hizo + su traducción fija
            logger.warning("Respaldo del avatar (%s) en el turno %d", problem or "llm", ctx.turn)
            text, translation = self._follow_up(lang, asked, ctx, used)
        return AgentReply(
            text,
            answered_by=by,
            game_state={
                "vocabulary_used": used,
                "correction": str(correction).strip() if correction else None,
                "translation": translation or None,  # [2026-10-20]: respaldo de NestJS si LanguageTools no traduce (fijo en los respaldos)
                # [2026-10-25]: ya no se pide al LLM (lo traduce LanguageTools); se conserva la clave por compatibilidad con NestJS
                "learner_translation": parse_translation((data or {}).get("learner_translation"), user_input),
            },
        )

    async def _plain(self, prompt: str, lang: str, asked: set[str]) -> str:
        """Intento sin JSON: primera línea de una respuesta en texto (si el modelo insiste en JSON, se extrae «reply»)."""
        try:
            raw = await self._llm.generate(f"{prompt}\nReply in {_LANG.get(lang, 'English')} with 1-2 sentences only.", max_tokens=120, temperature=0.7)
        except Exception:  # noqa: BLE001 — LLM caído: decide el respaldo determinista
            return ""
        parsed = loads_lenient(raw)  # [Tolerant Reader]: el modelo a veces responde JSON aunque se pida texto
        line = reply_text(parsed) if isinstance(parsed, dict) else next((x.strip().strip('"') for x in raw.splitlines() if x.strip()), "")
        line = _fix_spanish_lead(line.removeprefix("Aula:").strip(), lang)
        return "" if not line or line.startswith(("{", "[", "Revisa el concepto")) else line  # «Revisa el concepto…» = texto fijo del cliente caído

    @staticmethod
    def _follow_up(lang: str, asked: set[str], ctx: DialogueContext, used: list[str]) -> tuple[str, str]:
        """Pregunta de respaldo + traducción: contextual (sobre la palabra clave que dijo el alumno) y rotada por turno.

        [2026-10-25 · «Interesting! Can you tell me a bit more?» dos veces]: el filtro «ya preguntado» usa la memoria en RAM de
        FastAPI (se pierde al reiniciar/recargar) → ahora además se rota por `ctx.turn` (lo envía NestJS) y se prefiere una pregunta
        sobre lo que el alumno acaba de decir. [Paradigma]: función pura.
        """
        focus = used[-1] if used else None
        templates = FOCUS_FOLLOW_UPS.get(lang, FOCUS_FOLLOW_UPS["en"]) if focus else ()
        plain = list(zip(FOLLOW_UPS.get(lang, FOLLOW_UPS["en"]), FOLLOW_UPS["es"], strict=True))  # `zip`: pregunta + su traducción española
        shift = (ctx.turn - 1) % len(plain)  # Rotación por turno: con la memoria perdida tampoco se repite la misma
        options = [(q.format(w=focus), es.format(w=focus)) for q, es in zip(templates, FOCUS_FOLLOW_UPS["es"], strict=False)]
        options += plain[shift:] + plain[:shift]
        fresh = next(((q, es) for q, es in options if norm(q) not in asked), None)
        if fresh:
            return fresh
        said = " ".join(asked)
        word = next((w for w in ctx.vocabulary if norm(w) not in said), ctx.title)
        return f"{word}? {FOLLOW_UP.get(lang, FOLLOW_UP['en'])}", f"¿{word}? {FOLLOW_UP['es']}"


def reply_text(data: Any) -> str:
    """Texto de la respuesta aunque el modelo no use la clave «reply» ({"response": …}, {"reply": {"text": …}}). [Patrón]: Tolerant Reader."""
    if isinstance(data, str):
        return data.strip()
    if not isinstance(data, dict):
        return ""
    lowered = {str(k).lower(): v for k, v in data.items()}
    value = next((lowered[k] for k in _REPLY_KEYS if k in lowered), None)
    if isinstance(value, dict):  # {"reply": {"text": "..."}}
        return reply_text(value)
    return str(value).strip() if isinstance(value, str) else ""


def _fix_spanish_lead(text: str, lang: str) -> str:
    """Inglés: «El rooster's beak is…» → «The rooster's beak is…» (artículo español suelto al inicio de oración). [Paradigma]: función pura."""
    if lang != "en" or not text:
        return text
    # `re.sub` con función: conserva el separador de oración y cambia solo el artículo · «Los/Las» → «The» (inglés no marca número)
    return SPANISH_LEAD.sub(lambda m: m.group(0)[: m.start(1) - m.start(0)] + "The ", text)


def _problem(text: str, lang: str, asked: set[str]) -> str | None:
    """¿Qué le pasa a la respuesta? None = usable · «empty» · «spanish» · «repeat». [Patrón]: Specification. [Paradigma]: función pura."""
    if not text:
        return "empty"
    if drifted_to_spanish(text, lang):
        return "spanish"
    return "repeat" if _repeats(text, asked) else None


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
