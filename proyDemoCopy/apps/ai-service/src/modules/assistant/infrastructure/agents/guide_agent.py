"""GuideAgent — persona «guide»: orienta sobre el USO de la plataforma (Sprint 7.9 · RF-96).

[Patrón]: Strategy (implementa el puerto Agent) + Chain of Responsibility (FAQ → manual → LLM → «no lo sé»).
[Principio]: Deterministic-first (la FAQ responde sin LLM) + SRP + DIP (FAQ, manual y LLM inyectados).
[Paradigma]: POO + asíncrono.

Reglas del informe (cap. 15): no inventa funciones (el LLM solo redacta con lo recuperado), cita la sección, solo guía (no ejecuta acciones),
no accede a datos de otros usuarios (no recibe ninguno) y, si no sabe, lo dice y remite a la FAQ.
[2026-10-28 · NO es tutor]: el chat «Soporte y Guía» se comportaba como el tutor de idiomas → una petición de enseñar, traducir o practicar
un idioma se detecta ANTES de buscar (regex, sin LLM) y se responde con un texto fijo que remite al Tutor IA (/tutor); el prompt lo refuerza (NO_TUTOR).
"""

import logging
import re

from src.modules.assistant.application.use_cases.search_faq import SearchFaqUseCase
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.agent import AgentReply, Source
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.infrastructure.agents.guide_basics import NO_ANSWER, basic_answer, small_talk
from src.modules.assistant.infrastructure.clients.manual_retriever import ManualRetriever
from src.modules.feedback.domain.interfaces.llm_client import LLMClient

logger = logging.getLogger("ai-service.guide")

# [Petición de clase de idiomas]: frases típicas de tutoría (ES/EN) — estrechas a propósito: «¿dónde está el traductor?» o «mi banco de vocabulario»
# son preguntas de la PLATAFORMA y no deben desviarse | `re.I`: sin distinguir mayúsculas | [Patrón]: Guard Clause (antes de FAQ/manual/LLM)
_TUTORING = re.compile(
    r"c[oó]mo se dice|qu[eé] significa|tradu(ce|cir|zca|ceme|cime)\b|tradúce|\btranslate\b|how do you say|what does .+ mean"
    r"|\b(presente|pasado|futuro|pret[eé]rito)\s+(simple|perfecto|continuo|progresivo)|\b(present|past|future)\s+(simple|perfect|continuous)"
    r"|\bconjuga|ens[eé][ñn]ame\s+(ingl|franc|alem|portug|chin|rus|idiom|gram)|practicar\s+(mi\s+)?(ingl|franc|alem|portug|chin|rus|idiom|conversaci)"
    r"|\bpractice\s+(my\s+)?(english|french|german|portuguese|chinese|russian|speaking)|corrige\s+(mi|esta)\s+(frase|oraci)|correct\s+(my|this)\s+sentence"
    r"|\bgram[aá]tica\s+(de|del)\b|\bphrasal verb|\bverbos?\s+irregulares",
    re.I,
)
_NOT_TUTOR = "NO_TUTOR"  # Marca que el LLM devuelve si, pese al filtro, le piden una clase de idiomas
_TUTOR_REDIRECT = {
    "es": (
        "Soy el asistente de Soporte y Guía de la plataforma: no doy clases de idiomas. Para practicar, traducir o resolver dudas de "
        "gramática y vocabulario abre «Tutor IA» en el menú principal. ¿Te ayudo con algo de la plataforma (cuenta, pagos, cursos o un problema técnico)?"
    ),
    "en": (
        "I am the platform Support & Guide assistant: I do not teach languages. To practise, translate or ask about grammar and vocabulary, "
        "open «AI Tutor» in the main menu. Can I help you with the platform (account, payments, courses or a technical problem)?"
    ),
}
# [Regla común de los prompts]: no es tutor (refuerzo del filtro determinista) | [Principio]: DRY (se concatena a los dos modos)
_NO_TUTORING_RULE = {
    "es": f" No eres tutor de idiomas: si te piden enseñar, traducir, corregir o practicar un idioma, responde exactamente «{_NOT_TUTOR}».",
    "en": f" You are not a language tutor: if asked to teach, translate, correct or practise a language, answer exactly «{_NOT_TUTOR}».",
}

_SYSTEM = {
    "es": (
        "Eres el Agente Guía de Aula de Idiomas. Explicas cómo usar la plataforma con pasos numerados y breves. "
        "Usa SOLO las secciones del manual que se te dan; si no cubren la pregunta, responde exactamente «NO_SE». "
        "No inventes botones, menús ni funciones. No ejecutas acciones: solo indicas dónde hacerlas. "
        "Cita las secciones con [1], [2]… Máximo 6 oraciones."
    ),
    "en": (
        "You are the Aula de Idiomas Guide Agent. Explain how to use the platform with short numbered steps. "
        "Use ONLY the manual sections provided; if they do not cover the question, answer exactly «NO_SE». "
        "Do not invent buttons, menus or features. You do not perform actions: you only say where to do them. "
        "Cite sections as [1], [2]… At most 6 sentences."
    ),
}


# [Modo soporte · 2026-10-19]: misma cadena FAQ → manual → LLM, con instrucciones de atención al usuario (resolver problemas paso a paso)
_SUPPORT_SYSTEM = {
    "es": (
        "Eres el agente de Soporte y atención al usuario de Aula de Idiomas. Ayudas a resolver problemas (acceso, contraseña, pagos, "
        "certificados, audio o micrófono, errores de pantalla) con empatía y pasos numerados breves. "
        "Usa SOLO las secciones del manual que se te dan; si no cubren el problema, responde exactamente «NO_SE». "
        "No pidas contraseñas ni datos de tarjetas. Cita las secciones con [1], [2]… Máximo 6 oraciones."
    ),
    "en": (
        "You are the Aula de Idiomas Support and customer care agent. You help solve problems (login, password, payments, "
        "certificates, audio or microphone, screen errors) with empathy and short numbered steps. "
        "Use ONLY the manual sections provided; if they do not cover the problem, answer exactly «NO_SE». "
        "Never ask for passwords or card data. Cite sections as [1], [2]… At most 6 sentences."
    ),
}


class GuideAgent:
    # `mode` (2026-10-19): «guide» orienta sobre el uso · «support» resuelve problemas (mismas fuentes, otro tono) | [Patrón]: Strategy por configuración
    def __init__(self, llm: LLMClient, faq: SearchFaqUseCase, manual: ManualRetriever, manual_threshold: float, mode: str = "guide") -> None:
        base = _SUPPORT_SYSTEM if mode == "support" else _SYSTEM
        self._system = {loc: text + _NO_TUTORING_RULE[loc] for loc, text in base.items()}  # `dict comprehension`: prompt + regla «no soy tutor»
        self._mode = "support" if mode == "support" else "guide"
        self._no_answer = NO_ANSWER[self._mode]  # [2026-11-09]: «no lo sé» conversacional (pide más detalle) en vez de cortar la conversación
        self._llm = llm
        self._faq = faq
        self._manual = manual
        self._manual_threshold = manual_threshold

    async def reply(
        self,
        conversation: Conversation,
        user_input: str,
        language: str | None = None,
        context: ScreenContext | None = None,
    ) -> AgentReply:
        ctx = context or ScreenContext(route=None, role="USER")
        # 0) [No es tutor · 2026-10-28]: clase de idiomas → remite al Tutor IA sin FAQ, manual ni LLM | [Patrón]: Guard Clause
        if is_tutoring_request(user_input):
            return AgentReply(_TUTOR_REDIRECT[ctx.locale], [], "none")
        # 0b) [Saludo/agradecimiento · 2026-11-09]: «hola» respondía «No encontré…»
        if chat := small_talk(user_input, self._mode, ctx.locale):
            return AgentReply(chat, [], "none")
        # 1) [FAQ]: coincidencia alta → respuesta aprobada por un ADMIN, tal cual (sin LLM)
        hit = await self._faq.execute(user_input, locale=ctx.locale, role=ctx.role)
        if hit:
            d = hit.doc
            return AgentReply(d.source or d.text, [Source("faq", d.id, d.text, d.topic or None)], "faq")

        # 2) [Manual · RAG]: la ruta actual ayuda a encontrar la sección de esa pantalla
        query = f"{user_input} ({ctx.route})" if ctx.route else user_input
        sections = await self._manual.sections(query, locale=ctx.locale, role=ctx.role, min_score=self._manual_threshold)
        if not sections:
            # [2026-11-09]: sin manual → pasos básicos del tema frecuente (micrófono, inscripción…) antes de rendirse
            basic = _with_context(conversation, user_input, ctx.locale)
            return AgentReply(basic or self._no_answer[ctx.locale], [], "none")
        sources = [Source("manual", s.id, s.topic, s.kind) for s in sections]

        # 3) [LLM]: solo redacta con lo recuperado | historial corto para preguntas de seguimiento
        numbered = "\n\n".join(f"[{i}] {s.topic}\n{s.source or s.text}" for i, s in enumerate(sections, 1))
        history = "\n".join(f"{m.role}: {m.content}" for m in conversation.last_n(4))
        where = f"Pantalla actual: {ctx.route}\n" if ctx.route else ""
        prompt = f"{where}Secciones del manual:\n{numbered}\n\nConversación previa:\n{history}\n\nPregunta: {user_input}\nRespuesta:"
        try:
            # [Fix 2026-10-27 · strict=True]: sin él, OllamaClient NO lanzaba con Ollama caído o el modelo sin descargar (404): devolvía su texto genérico
            # «Revisa el concepto clave…» y el Agente Guía lo publicaba como respuesta «llm» → este `except` nunca se ejecutaba | [Principio]: Fail Fast hacia el llamador
            text = (await self._llm.generate(prompt, system=self._system[ctx.locale], max_tokens=350, temperature=0.2, strict=True)).strip()
        except Exception as exc:  # noqa: BLE001 — LLM caído: la sección más parecida sigue siendo una respuesta verificada
            logger.warning("Agente Guía sin LLM (%s): se devuelve la sección del manual", exc)
            return AgentReply(sections[0].source or sections[0].text, sources[:1], "manual")
        if _NOT_TUTOR in text:  # El LLM detectó una clase de idiomas que escapó al filtro
            return AgentReply(_TUTOR_REDIRECT[ctx.locale], [], "none")
        if not text or "NO_SE" in text:
            return AgentReply(_with_context(conversation, user_input, ctx.locale) or self._no_answer[ctx.locale], [], "none")
        return AgentReply(text, sources, "llm")


def _with_context(conversation: Conversation, user_input: str, locale: str) -> str | None:
    """[2026-11-11 · «no veo el botón de comprar» tras «¿Cómo pago un curso?» → «¿Qué quieres hacer?»]: sin tema propio, el de la pregunta
    anterior del usuario (seguimiento de la conversación). Función pura sobre el historial."""
    if basic := basic_answer(user_input, locale):
        return basic
    before = [m.content for m in conversation.last_n(6) if m.role == "user" and m.content.strip() != user_input.strip()]
    return basic_answer(f"{before[-1]} {user_input}", locale) if before else None


def is_tutoring_request(text: str) -> bool:
    """¿Piden una clase de idiomas (traducir, gramática, practicar)? Regex estrecha, sin LLM. | Función pura."""
    return bool(_TUTORING.search(text))
