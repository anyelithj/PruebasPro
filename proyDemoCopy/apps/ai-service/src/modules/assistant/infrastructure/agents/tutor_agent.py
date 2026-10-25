"""TutorAgent — tutor de idiomas con RAG sobre el currículo aprobado + LLM (Sprint 5.3).

[Patron]: Adapter + Strategy (implementa el puerto Agent).
[Principio]: SRP + DIP.
[Paradigma]: POO + asincrono.
[Implementación]: directa sin LangChain (más controlable, menos dependencias).
"""
import re
from difflib import SequenceMatcher

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.agent import AgentReply
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.feedback.domain.interfaces.llm_client import LLMClient
from src.modules.feedback.infrastructure.clients.rag_retriever import RAGRetriever
from src.shared.domain.text_norm import drifted_to_spanish

_LANGUAGES = {
    "en": "inglés", "fr": "francés", "de": "alemán", "es": "español",
    "pt": "portugués", "zh": "chino mandarín", "ru": "ruso",
}

_SYSTEM_PROMPT = (
    "Eres el tutor de idiomas de AulaDeIdiomas. Usas el español y el idioma que estudia el alumno en la proporción que marca "
    "la «Política de idioma» de su nivel, con tono claro y motivador, y das ejemplos en el idioma que estudia con su traducción. "
    "El «Material de referencia» es material del curso que el alumno AÚN NO HA VISTO en este chat: "
    "úsalo solo si responde a su pregunta y no lo contradigas; si no la cubre, responde con prudencia indicando que es una explicación general. "
    "Nunca digas que ya diste ejemplos o explicaciones que no aparecen en la «Conversación previa». "
    "Corrige con amabilidad los errores del alumno y termina proponiendo un ejercicio breve. "
    "Máximo 6 oraciones."
)


# [Charla corta]: saludos/agradecimientos de hasta 4 palabras → no se consulta el índice | `frozenset`: búsqueda O(1)
_SMALL_TALK = frozenset({
    "hola", "hi", "hello", "hey", "buenas", "buenos", "días", "dias", "tardes", "noches", "gracias", "thanks", "ok", "vale",
    "bonjour", "salut", "hallo", "olá", "ola", "привет", "你好", "adiós", "adios", "bye", "chao", "qué", "que", "tal", "cómo", "como", "estás", "estas",
})


# [Política de idioma por nivel MCER · 2026-10-23]: cuánto español puede usar el TUTOR y cuánto el ALUMNO, y cuándo se le pide pasar al idioma meta
# A1–A2: apoyo fuerte en español · B1–B2: el idioma meta domina · C1–C2: casi sin español | [Patrón]: Table-Driven (dict) | [Principio]: OCP (nuevo nivel = nueva fila)
_LEVEL_POLICY = {
    "A": (
        "Nivel inicial (A1–A2). Tú: ~70 % español y ~30 % {lang} (frases cortas y siempre traducidas). "
        "El alumno puede escribir hasta la mitad de las palabras en español; anímalo a usar en {lang} las palabras que ya conoce."
    ),
    "B": (
        "Nivel intermedio (B1–B2). Tú: ~70 % {lang} y español solo para aclarar gramática difícil (máx. ~30 %). "
        "El alumno puede usar como mucho 2–3 palabras en español por mensaje; pídele expresamente que te escriba en {lang}."
    ),
    "C": (
        "Nivel avanzado (C1–C2). Tú: responde en {lang} (español solo para un matiz, máx. ~5 %). "
        "El alumno no debe usar español: si lo hace, pídele que lo reformule en {lang}."
    ),
}
# [Ejemplo de cómo actuar si el alumno escribe en español de más] (few-shot): responder + «Dilo en {lang}: …» + pedirle que lo repita
_SPANISH_EXAMPLE = (
    "Si el alumno escribe en español más de lo que permite su nivel: 1) responde brevemente a lo que dijo, "
    "2) muéstrale cómo decirlo en {lang} con la frase completa, 3) pídele que lo escriba él en {lang}. Ejemplo: "
    "Alumno: «Me gusta vestirme en invierno con botas y chaqueta de lana. ¿Podemos usar \"sweater\" con el verbo to be?» → "
    "Tutor: «¡Buena idea! En inglés: \"In winter I like to wear boots and a wool jacket.\" Con to be: \"My sweater is warm.\" "
    "Ahora tú: escribe en inglés qué te pones en invierno usando \"is\" o \"are\".»"
)


def _policy(level: str | None, language: str | None) -> str:
    """Instrucción de idioma según el nivel (sin nivel → intermedio). [Paradigma]: función pura."""
    lang = _LANGUAGES.get(language or "", "el idioma que estudia")
    band = (level or "B1")[:1].upper()
    return f"Política de idioma: {_LEVEL_POLICY.get(band, _LEVEL_POLICY['B']).format(lang=lang)}\n{_SPANISH_EXAMPLE.format(lang=lang)}\n"


def _is_small_talk(text: str) -> bool:
    words = [w.strip("¡!¿?.,;:") for w in text.lower().split()]
    return 0 < len(words) <= 4 and all(w in _SMALL_TALK for w in words if w)


class TutorAgent:
    def __init__(self, llm: LLMClient, retriever: RAGRetriever) -> None:
        self._llm = llm
        self._retriever = retriever

    # `context` (Sprint 7.9): parte del puerto Agent; el tutor solo lee `level` (Sprint 7.8), no la pantalla
    async def reply(
        self, conversation: Conversation, user_input: str, language: str | None = None, context: ScreenContext | None = None
    ) -> AgentReply:
        # [RAG]: material aprobado del idioma que estudia el alumno | un saludo NO busca material (antes un «hola» traía vocabulario al azar
        # y el modelo hablaba de «los ejemplos que te di») | `min_score` 0.45: solo fragmentos realmente parecidos a la pregunta
        snippets = [] if _is_small_talk(user_input) else await self._retriever.retrieve(user_input, top_k=3, language=language, min_score=0.45)
        context_block = "\n".join(f"- {s}" for s in snippets) if snippets else "(sin material del curso para esta pregunta)"

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
            f"{studying}Material de referencia:\n{context_block}\n\n"
            f"Conversación previa:\n{history_block}\n\n"
            f"Estudiante: {user_input}\nTutor:"
        )
        # [Ya hubo saludo · 2026-10-20]: el modelo copiaba su saludo («¡Hola! Encantado de verte…») a cada mensaje → orden explícita de responder al tema
        previous = [m.content for m in conversation.messages[:-1] if m.role == "assistant"]
        small_talk = _is_small_talk(user_input)
        if small_talk:  # [2026-10-23]: solo ante un saludo se pide saludar y preguntar qué practicar
            prompt += " (El alumno solo saluda: salúdalo brevemente y pregúntale qué quiere practicar.)"
        elif previous:
            prompt += f" (Ya saludaste: NO saludes otra vez; responde directamente a «{user_input}».)"
        # [Determinístico]: desde B1, un mensaje casi todo en español activa el paso «dilo en el idioma meta» de forma explícita
        if language and language != "es" and (level or "B1")[:1].upper() in "BC" and not small_talk and drifted_to_spanish(user_input, language):
            prompt += f" (El alumno escribió en español: muéstrale cómo decirlo en {_LANGUAGES.get(language, language)} y pídele que lo escriba él.)"
        reply = await self._llm.generate(prompt, system=_SYSTEM_PROMPT, max_tokens=400, temperature=0.5)
        # [Limpieza]: modelos pequeños a veces repiten el guion «Estudiante: … Tutor:» → se queda lo último del tutor
        text = reply.rsplit("Tutor:", 1)[-1].strip()
        # [Guarda de repetición]: respuesta casi igual a una anterior (≥ 75 %) → un reintento más creativo centrado solo en la pregunta
        # [Evasiva · 2026-10-23]: ante un tema real («los artículos a, an, the») el modelo volvía a saludar y a preguntar qué practicar → también se reintenta
        if (previous and _repeats(text, previous)) or (not small_talk and _dodges(text)):
            retry = await self._llm.generate(
                f"{studying}Material de referencia:\n{context_block}\n\nPregunta del estudiante: {user_input}\n"
                "Explica ESTE tema con un ejemplo y su traducción; no saludes ni repitas frases anteriores.\nTutor:",
                system=_SYSTEM_PROMPT, max_tokens=400, temperature=0.8,
            )
            text = retry.rsplit("Tutor:", 1)[-1].strip() or text
        return AgentReply(text)


# [_DODGE]: respuesta que no entra al tema — empieza saludando o pregunta qué se quiere practicar | `re.I`: sin distinguir mayúsculas
_DODGE = re.compile(r"^\W*(hola|hello|hi|buenas)\b|qu[eé] (te gustar[ií]a|quieres) practicar|alguna parte espec[ií]fica", re.I)


def _dodges(text: str) -> bool:
    """¿La respuesta esquiva la pregunta (saluda de nuevo o pregunta qué practicar)? | Función pura."""
    return bool(_DODGE.search(text))


def _repeats(text: str, previous: list[str]) -> bool:
    """¿El texto repite (≥ 75 % de parecido) alguna respuesta anterior del tutor? `SequenceMatcher` (difflib, stdlib) | Función pura."""
    return any(SequenceMatcher(None, text.lower(), p.lower()).ratio() >= 0.75 for p in previous[-3:])
