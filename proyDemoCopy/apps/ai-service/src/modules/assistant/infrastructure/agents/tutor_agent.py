"""TutorAgent — tutor de idiomas con RAG sobre el currículo aprobado + LLM (Sprint 5.3).

[Patron]: Adapter + Strategy (implementa el puerto Agent).
[Principio]: SRP + DIP.
[Paradigma]: POO + asincrono.
[Implementación]: directa sin LangChain (más controlable, menos dependencias).
[2026-10-28 · Uso del idioma]: el tutor dice CUÁNDO empezar a escribir en el idioma meta (aviso determinista, una vez), mide qué % de palabras
del alumno van en ese idioma (meta por nivel MCER: TARGET_SHARE_BY_LEVEL) y, si un mensaje queda por debajo, le pide reescribirlo.
"""
import re
from difflib import SequenceMatcher

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.agent import AgentReply, Source
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.feedback.domain.interfaces.llm_client import LLMClient
from src.modules.feedback.infrastructure.clients.rag_retriever import RAGRetriever, reference_lines
from src.modules.assistant.domain.value_objects.pronunciation_query import pronunciation_targets  # [Tarea 9]: pronunciación → diccionario
from src.modules.language_tools.domain.interfaces.phonetizer import Phonetizer  # [Port]: diccionario fonético (espeak-ng)
from src.modules.language_tools.domain.language_voices import ipa_voices
# [2026-10-28]: meta de idioma por nivel + medición determinista del uso del idioma meta (Shared Kernel del módulo)
from src.modules.assistant.domain.value_objects.language_usage import (
    DEFAULT_LEVEL,
    REPHRASE_ASKED,
    SWITCH_ANNOUNCED,
    LanguageUsage,
    measure_conversation,
    measure_turn,
    target_share,
)

_LANGUAGES = {
    "en": "inglés", "fr": "francés", "de": "alemán", "es": "español",
    "pt": "portugués", "zh": "chino mandarín", "ru": "ruso",
}

_SYSTEM_PROMPT = (
    "Eres el tutor de idiomas de AulaDeIdiomas. Usas el español y el idioma que estudia el alumno en la proporción que marca "
    "la «Política de idioma» de su nivel, con tono claro y motivador, y das ejemplos en el idioma que estudia con su traducción. "
    "El bloque «REFERENCIAS» es material revisado del curso que el alumno AÚN NO HA VISTO en este chat: "
    "úsalo solo si responde a su pregunta, no lo contradigas, explícalo con tus propias palabras (sin copiar párrafos) y cita la fuente entre corchetes. "
    # [Tarea 9 · RF-57]: sin material no se inventan reglas
    "Si REFERENCIAS está vacío y el alumno pide una regla o una explicación, dile que ese tema aún no está en el material del curso "
    "y no inventes reglas; puedes seguir practicando con él. "
    # [Tarea 9 · Pronunciación]: la IPA sale del diccionario fonético, no del modelo ni del RAG
    "Si hay un bloque «PRONUNCIACIÓN», usa EXACTAMENTE esa IPA (no la cambies) y explícala con una pista en español. "
    "Nunca digas que ya diste ejemplos o explicaciones que no aparecen en la «Conversación previa». "
    # [2026-10-25 · Práctica dinámica]: la UI abre con el saludo del tutor (pregunta qué tema practicar)
    "Si el alumno aún no ha dicho el tema, pregúntale cuál con 2-3 ideas cortas de su nivel. "
    # [2026-10-30]: el tutor también resuelve dudas: no todo mensaje es para practicar
    "Si el alumno pregunta una duda de teoría o dice que no entendió algo, explícalo claro en español con un ejemplo y pregúntale si quedó claro; no lo obligues a practicar. "
    # [2026-10-28]: el aviso «A partir de tu próximo mensaje, escríbeme en …» y la petición de reescribir los añade el SISTEMA (deterministas) → el modelo no los repite
    "Cuando lo diga: da la regla en MÁXIMO 2 líneas (fórmula + 1 ejemplo con traducción) y lanza el primer reto en {lang}. "
    "El sistema añadirá después el aviso de cuándo escribir en {lang} y la meta de su nivel: NO lo escribas tú ni cierres con traducciones largas. "
    "Después practica por turnos en {lang}: UN mini-reto por mensaje, "
    "alternando tipos (completa la frase, traduce, elige la opción correcta, responde una pregunta sobre ti, corrige el error); "
    "corrige su respuesta en una línea (✓ bien / mejor así: …) y lanza el siguiente, subiendo poco a poco la dificultad. "
    # [2026-11-09]: «Completa la frase en alemán: "El perro corre y ___ salta."» (frase en español) → los retos SIEMPRE en {lang}
    "Las frases de los retos (completar, ordenar, corregir, elegir) se escriben SIEMPRE en {lang}; el español solo va entre paréntesis como pista. "
    "Revisa que tus ejemplos en {lang} sean gramaticalmente correctos (género, artículos, conjugación). "
    # [2026-11-09]: «Mejor así: <la misma frase>» confundía al alumno → solo si cambias algo
    "Si la frase del alumno es correcta, di ✓ y NO la repitas como «mejor así»; usa «mejor así» solo si cambias palabras, y di en una línea qué cambió y por qué. "
    # [2026-11-09]: la charla se cortaba tras la corrección → siempre continúa hasta que el alumno se despida
    "Termina SIEMPRE con una pregunta o el siguiente reto para seguir la conversación, salvo que el alumno se despida o diga que quiere parar. "
    "Nunca des listas largas ni repitas la explicación. Máximo 4 oraciones."
)


# [Charla corta]: saludos/agradecimientos de hasta 4 palabras → no se consulta el índice | `frozenset`: búsqueda O(1)
_SMALL_TALK = frozenset({
    "hola", "hi", "hello", "hey", "buenas", "buenos", "días", "dias", "tardes", "noches", "gracias", "thanks", "ok", "vale",
    "bonjour", "salut", "hallo", "olá", "ola", "привет", "你好", "adiós", "adios", "bye", "chao", "qué", "que", "tal", "cómo", "como", "estás", "estas",
})


# [Política de idioma por nivel MCER · 2026-10-23 → 2026-10-28]: cuánto español usa el TUTOR por banda + meta mínima del ALUMNO por nivel
# (la meta sale de TARGET_SHARE_BY_LEVEL: A1 30 % · A2 40 % · B1 60 % · B2 75 % · C1 90 % · C2 100 %) | [Patrón]: Table-Driven (dict) | [Principio]: OCP + SSOT
_LEVEL_POLICY = {
    "A": "Nivel inicial (A1–A2). Tú: ~70 % español y ~30 % {lang} (frases cortas y siempre traducidas).",
    "B": "Nivel intermedio (B1–B2). Tú: ~70 % {lang} y español solo para aclarar gramática difícil (máx. ~30 %).",
    "C": "Nivel avanzado (C1–C2). Tú: responde en {lang} (español solo para un matiz, máx. ~5 %).",
}
_STUDENT_GOAL = "El alumno debe escribir al menos el {pct} % de sus palabras en {lang} (meta de su nivel {level}); anímalo a usar en {lang} lo que ya sabe."
# [Ejemplo de cómo actuar si el alumno escribe en español de más] (few-shot): responder + «Dilo en {lang}: …» + pedirle que lo repita
_SPANISH_EXAMPLE = (
    "Si el alumno escribe en español más de lo que permite su meta: 1) responde brevemente a lo que dijo, "
    "2) muéstrale cómo decirlo en {lang} con la frase completa. Ejemplo: "
    "Alumno: «Me gusta vestirme en invierno con botas y chaqueta de lana.» → "
    "Tutor: «¡Buena idea! En inglés: \"In winter I like to wear boots and a wool jacket.\"»"
)

# [Textos deterministas del sistema · 2026-10-28]: se AÑADEN a la respuesta del modelo (no dependen de que el LLM obedezca) | [Principio]: Deterministic-first
# `{pct}` entero (40) · `{ratio}` entero (25) | las frases casan con SWITCH_ANNOUNCED / REPHRASE_ASKED (language_usage) → nunca se repiten
# [2026-11-09]: «el 40 % de tus palabras» no se entendía → la meta es sobre la conversación
# [2026-11-09 · 2.º pase]: sonaba a orden brusca → invitación + qué hacer si no sabe decir algo
_SWITCH_LINE = "Ahora te toca a ti: a partir de tu próximo mensaje, intenta escribirme en {lang}. En el nivel {level} la meta es que al menos el {pct} % de la conversación sea en {lang}; si no sabes decir algo, escríbelo en español y te ayudo."
_CONTINUE_LINE = "¿Seguimos? Escríbeme otra frase en {lang} sobre este tema."  # [2026-11-09]: la conversación no se queda sin siguiente paso
_REPHRASE_LINE = "Tu uso del {lang} en esta conversación va en {ratio} % (meta {pct} %). Reescribe tu último mensaje en {lang}, por favor."


def _pct(x: float) -> int:
    """0.4 → 40 | `round` (builtin): porcentaje entero para el alumno. [Paradigma]: función pura."""
    return round(x * 100)


def _policy(level: str | None, language: str | None) -> str:
    """Instrucción de idioma según el nivel (sin nivel → intermedio). [Paradigma]: función pura."""
    lang = _LANGUAGES.get(language or "", "el idioma que estudia")
    lvl = (level or DEFAULT_LEVEL).upper()
    goal = _STUDENT_GOAL.format(pct=_pct(target_share(lvl)), lang=lang, level=lvl)
    return f"Política de idioma: {_LEVEL_POLICY.get(lvl[:1], _LEVEL_POLICY['B']).format(lang=lang)} {goal}\n{_SPANISH_EXAMPLE.format(lang=lang)}\n"


def _is_small_talk(text: str) -> bool:
    words = [w.strip("¡!¿?.,;:") for w in text.lower().split()]
    return 0 < len(words) <= 4 and all(w in _SMALL_TALK for w in words if w)


class TutorAgent:
    def __init__(self, llm: LLMClient, retriever: RAGRetriever, phonetizer: Phonetizer | None = None) -> None:
        self._llm = llm
        self._retriever = retriever
        self._phonetizer = phonetizer  # [Tarea 9]: None = sin diccionario fonético (tests); la pronunciación cae al modelo con prudencia

    async def _pronunciation(self, user_input: str, language: str | None) -> str:
        """Bloque «PRONUNCIACIÓN» con la IPA del diccionario (vacío si no se pregunta por pronunciación o no hay diccionario)."""
        words = pronunciation_targets(user_input)
        if not words or self._phonetizer is None or language not in _LANGUAGES:
            return ""
        try:
            per_accent = {accent: await self._phonetizer.ipa_words(words, voice) for accent, voice in ipa_voices(language).items()}
        except Exception:  # noqa: BLE001 — sin espeak-ng el tutor sigue respondiendo
            return ""
        lines = [
            f"- {w}: " + " · ".join(f"/{ipa[i]}/" + ("" if accent == "default" else f" ({accent.upper()})") for accent, ipa in per_accent.items() if ipa[i])
            for i, w in enumerate(words)
        ]
        return "PRONUNCIACIÓN (diccionario fonético espeak-ng, IPA):\n" + "\n".join(lines) + "\n\n"

    # `context` (Sprint 7.9): parte del puerto Agent; el tutor solo lee `level` (Sprint 7.8), no la pantalla
    async def reply(
        self, conversation: Conversation, user_input: str, language: str | None = None, context: ScreenContext | None = None
    ) -> AgentReply:
        # [RAG]: material aprobado del idioma que estudia el alumno | un saludo NO busca material (antes un «hola» traía vocabulario al azar
        # y el modelo hablaba de «los ejemplos que te di») | `min_score` 0.45: solo fragmentos realmente parecidos a la pregunta
        # [Tarea 9]: búsqueda híbrida filtrada por idioma y nivel con la última pregunta + el turno previo del tutor («no lo entendí» → tema de la charla)
        level = context.level if context else None
        pronunciation = await self._pronunciation(user_input, language)  # Pronunciación → diccionario directo, en lugar del RAG
        refs = [] if _is_small_talk(user_input) or pronunciation else await self._retriever.references(
            _query(conversation, user_input), language=language, level=level.upper() if _is_level(level) else None, purpose="tutor",
            owner=conversation.user_id,  # [2026-11-14]: también las palabras que ESTE alumno marcó para aprender
        )
        context_block = "\n".join(f"- {s}" for s in reference_lines(refs)) if refs else "(vacío: sin material del curso para esta pregunta)"

        # [Historial corto]: últimos 6 turnos SIN el mensaje actual (el caso de uso ya lo añadió y va abajo como «Estudiante:») | [Patron]: Sliding Window
        history_block = "\n".join(
            f"{'Estudiante' if m.role == 'user' else 'Tutor'}: {m.content}" for m in conversation.last_n(7)[:-1]
        ) or "(ninguna: es el primer mensaje del alumno)"
        studying = f"El alumno estudia {_LANGUAGES[language]}.\n" if language in _LANGUAGES else ""
        level = context.level if context else None
        if level:  # [Nivel MCER · Sprint 7.8]: gradúa vocabulario, gramática y longitud de los ejemplos
            studying += f"Su nivel MCER es {level}: usa vocabulario y estructuras de ese nivel.\n"
        if language and language != "es":  # [2026-10-23]: cuánto español se permite y cómo pedir el idioma meta
            studying += _policy(level, language)
        prompt = (
            f"{studying}{pronunciation}REFERENCIAS:\n{context_block}\n\n"
            f"Conversación previa:\n{history_block}\n\n"
            f"Estudiante: {user_input}\nTutor:"
        )
        # [Ya hubo saludo · 2026-10-20]: el modelo copiaba su saludo («¡Hola! Encantado de verte…») a cada mensaje → orden explícita de responder al tema
        previous = [m.content for m in conversation.messages[:-1] if m.role == "assistant"]
        small_talk = _is_small_talk(user_input)
        if small_talk:  # [2026-10-23]: solo ante un saludo se pide saludar y preguntar qué practicar
            prompt += " (El alumno solo saluda: NO vuelvas a saludar largo; pregúntale qué tema quiere practicar con 2-3 ideas de su nivel.)"
        elif previous:
            prompt += f" (Ya saludaste: NO saludes otra vez; responde directamente a «{user_input}».)"
        # [Uso del idioma · 2026-10-28]: medición determinista de TODA la conversación (incluido este mensaje) → prompt + aviso + UI
        usage = measure_conversation(conversation.messages, language or "", level) if _measures(language) else None
        lang_name = _LANGUAGES.get(language or "", language or "")
        doubt = _is_doubt(user_input)  # [2026-10-30]: una duda de teoría se puede preguntar en español: ni aviso de cambio ni «reescríbelo»
        must_rephrase = usage is not None and usage.announced and not small_talk and not doubt and _short_of_goal(user_input, usage)
        if doubt and not small_talk:  # [2026-11-09]: la duda se explicaba y la charla moría en «¿Entiendes esto?» → explicación + mini-ejercicio para que participe
            prompt += f" (El alumno tiene una duda: explícala en español, sencillo, con 2 ejemplos cortos en {lang_name} y su traducción correcta; termina con UN mini-ejercicio fácil en {lang_name} para comprobar que lo entendió.)"
        if must_rephrase:  # [Enforce]: el mensaje no llega a la meta → respuesta breve + cómo decirlo en el idioma meta (la petición de reescribir la añade el sistema)
            prompt += f" (El alumno escribió casi todo en español: responde en una línea y muéstrale cómo decirlo en {lang_name}; no lances un reto nuevo.)"
        system = _SYSTEM_PROMPT.format(lang=_LANGUAGES.get(language or "", "el idioma que estudias"))  # [2026-10-25]: «A partir de ahora respóndeme en inglés»
        reply = await self._llm.generate(prompt, system=system, max_tokens=400, temperature=0.5)
        # [Limpieza]: modelos pequeños a veces repiten el guion «Estudiante: … Tutor:» → se queda lo último del tutor
        text = _clean_reply(reply)
        # [Guarda de repetición]: respuesta casi igual a una anterior (≥ 75 %) → un reintento más creativo centrado solo en la pregunta
        # [Evasiva · 2026-10-23]: ante un tema real («los artículos a, an, the») el modelo volvía a saludar y a preguntar qué practicar → también se reintenta
        if not text or (previous and _repeats(text, previous)) or (not small_talk and _dodges(text)):
            retry = await self._llm.generate(
                f"{studying}REFERENCIAS:\n{context_block}\n\nPregunta del estudiante: {user_input}\n"
                "Explica ESTE tema con un ejemplo y su traducción; no saludes ni repitas frases anteriores.\nTutor:",
                system=system, max_tokens=400, temperature=0.8,
            )
            text = _clean_reply(retry) or text or f"¡Muy bien! Escribe otra frase en {lang_name} sobre este tema."  # Último recurso: nunca un mensaje vacío
        text = _drop_same_fix(text, user_input)
        bye = _is_farewell(user_input)
        if not bye and not must_rephrase and not small_talk and "?" not in text and language in _LANGUAGES and language != "es":
            text = f"{text}\n\n{_CONTINUE_LINE.format(lang=lang_name)}"
        text = _with_expectations(text, usage, lang_name, small_talk or doubt or bye, must_rephrase)
        sources = [Source("curriculum", d.id, d.topic, d.origin or None) for d in refs]  # RNF-35: fragmentos que respaldan la respuesta
        return AgentReply(text, sources=sources, language_usage=usage)


_LEVELS = frozenset({"A1", "A2", "B1", "B2", "C1", "C2"})  # Niveles MCER válidos para filtrar el RAG


def _is_level(level: str | None) -> bool:
    """¿Es un nivel MCER exacto? (otro valor no filtra el RAG). | Función pura."""
    return (level or "").upper() in _LEVELS


def _query(conversation: Conversation, user_input: str) -> str:
    """Consulta del RAG: el mensaje + el último turno del tutor si el mensaje es corto («no lo entendí»). | Función pura.

    [Caso B]: «no entendí el tema del verbo to be» ya nombra el tema; «no lo entendí» lo toma de lo que el tutor dijo justo antes.
    """
    previous = next((m.content for m in reversed(conversation.messages[:-1]) if m.role == "assistant"), "")
    return f"{user_input}\n{previous[:300]}" if previous and len(user_input.split()) <= 8 else user_input


# [_ECHO]: el modelo pequeño a veces continúa el guion y copia su contexto | `re.I`: sin distinguir mayúsculas | `re.M`: `^` por línea
_ECHO = re.compile(r"^\s*(estudiante|alumno|student)\s*:", re.I | re.M)
# [_RULE_ECHO]: frase que repite la meta del sistema («En el nivel A2 tu meta es…») → la dice el aviso determinista, no el modelo
_RULE_ECHO = re.compile(r"[^.!?\n]*\b(tu meta es|meta de su nivel|política de idioma)\b[^.!?\n]*[.!?]?", re.I)
# [_DOUBT]: pregunta o duda de teoría del alumno
_DOUBT = re.compile(r"\?|\b(no entiendo|no entend[ií]|no (me )?qued[oó] (muy |tan )?claro|tengo (una |unas |muchas )?dudas?|qu[eé] significa|por qu[eé]|c[oó]mo se|expl[ií]ca|cu[aá]ndo se usa|diferencia entre)\b", re.I)


def _clean_reply(reply: str) -> str:
    """Quita lo que el modelo copió de su contexto. [Bug 2026-10-30]: «I can dance» → «En el nivel A2 tu meta es…\\n\\nEstudiante: I can dance».

    [Patrón]: Anti-Corruption Layer (LLM → dominio) | [Principio]: Deterministic-first | [Paradigma]: función pura.
    """
    text = reply.rsplit("Tutor:", 1)[-1]
    echo = _ECHO.search(text)
    return _RULE_ECHO.sub("", text[: echo.start()] if echo else text).strip()


# [_FAREWELL · 2026-11-09]: el alumno se despide o quiere parar → sin reto nuevo
_FAREWELL = re.compile(r"\b(adi[oó]s|chao|hasta luego|nos vemos|bye|goodbye|see you|no quiero (seguir|continuar)|ya no m[aá]s|terminamos|para(mos)? aqu[ií])\b", re.I)
# [_SAME_FIX]: «(Mejor así: "frase")» / «Mejor así: frase» con la MISMA frase del alumno → ruido
_SAME_FIX = re.compile(r"\(?\s*mejor as[ií]\s*:\s*[\"“«]?([^\"”»)\n]+)[\"”»]?\s*\)?\.?", re.I)


def _words(s: str) -> str:
    return " ".join(re.findall(r"[\w']+", s.lower()))


def _drop_same_fix(text: str, user_input: str) -> str:
    """Quita «Mejor así: X» cuando X es lo mismo que dijo el alumno (solo cambian mayúsculas o puntos). | Función pura."""
    said = _words(user_input)
    return _SAME_FIX.sub(lambda m: "" if _words(m.group(1)) == said else m.group(0), text).strip()


def _is_farewell(text: str) -> bool:
    """¿El alumno se despide o quiere terminar? | Función pura."""
    return bool(_FAREWELL.search(text))


def _is_doubt(text: str) -> bool:
    """¿El alumno pregunta una duda en vez de practicar? | Función pura."""
    return bool(_DOUBT.search(text))


def _measures(language: str | None) -> bool:
    """¿Se mide el uso del idioma? Solo si estudia un idioma distinto del español (el de la interfaz). | Función pura."""
    return bool(language) and language != "es" and language in _LANGUAGES


def _short_of_goal(user_input: str, usage: LanguageUsage) -> bool:
    """¿ESTE mensaje queda por debajo de la meta del nivel? (el acumulado puede ir bien y aun así pedir reescribir uno en español). | Función pura."""
    turn = measure_turn(user_input, usage.language)
    return turn.words > 0 and turn.share + 1e-9 < usage.target


def _with_expectations(text: str, usage: LanguageUsage | None, lang: str, small_talk: bool, must_rephrase: bool) -> str:
    """Añade, de forma determinista, el aviso de cuándo escribir en el idioma meta (una vez) o la petición de reescribir.

    [Bug 2026-10-28]: «el presente simple» → el tutor explicaba en español con un ejemplo y una traducción, pero NUNCA decía cuándo pasar al inglés.
    [Patrón]: Decorator (sobre el texto del LLM) | [Principio]: Deterministic-first (no depende de que el modelo obedezca) + idempotente (regex de language_usage).
    """
    if usage is None:
        return text
    level, pct = usage.level, _pct(usage.target)
    if not usage.announced and not small_talk and not SWITCH_ANNOUNCED.search(text):
        return f"{text}\n\n{_SWITCH_LINE.format(lang=lang, level=level, pct=pct)}"
    if must_rephrase and not REPHRASE_ASKED.search(text):
        return f"{text}\n\n{_REPHRASE_LINE.format(lang=lang, ratio=_pct(usage.ratio), pct=pct)}"
    return text


# [_DODGE]: respuesta que no entra al tema — empieza saludando o pregunta qué se quiere practicar | `re.I`: sin distinguir mayúsculas
_DODGE = re.compile(r"^\W*(hola|hello|hi|buenas)\b|qu[eé] (te gustar[ií]a|quieres) practicar|alguna parte espec[ií]fica", re.I)


def _dodges(text: str) -> bool:
    """¿La respuesta esquiva la pregunta (saluda de nuevo o pregunta qué practicar)? | Función pura."""
    return bool(_DODGE.search(text))


def _repeats(text: str, previous: list[str]) -> bool:
    """¿El texto repite (≥ 75 % de parecido) alguna respuesta anterior del tutor? `SequenceMatcher` (difflib, stdlib) | Función pura."""
    return any(SequenceMatcher(None, text.lower(), _core(p).lower()).ratio() >= 0.75 for p in previous[-3:])


def _core(text: str) -> str:
    """Respuesta anterior SIN las líneas deterministas del sistema (si no, todas se parecerían por el aviso). | Función pura."""
    return "\n".join(line for line in text.splitlines() if not (SWITCH_ANNOUNCED.search(line) or REPHRASE_ASKED.search(line))).strip()
