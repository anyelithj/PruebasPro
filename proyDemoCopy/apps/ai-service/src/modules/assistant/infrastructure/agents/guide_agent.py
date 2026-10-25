"""GuideAgent — persona «guide»: orienta sobre el USO de la plataforma (Sprint 7.9 · RF-96).

[Patrón]: Strategy (implementa el puerto Agent) + Chain of Responsibility (FAQ → manual → LLM → «no lo sé»).
[Principio]: Deterministic-first (la FAQ responde sin LLM) + SRP + DIP (FAQ, manual y LLM inyectados).
[Paradigma]: POO + asíncrono.

Reglas del informe (cap. 15): no inventa funciones (el LLM solo redacta con lo recuperado), cita la sección, solo guía (no ejecuta acciones),
no accede a datos de otros usuarios (no recibe ninguno) y, si no sabe, lo dice y remite a la FAQ.
"""

import logging

from src.modules.assistant.application.use_cases.search_faq import SearchFaqUseCase
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.agent import AgentReply, Source
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.infrastructure.clients.manual_retriever import ManualRetriever
from src.modules.feedback.domain.interfaces.llm_client import LLMClient

logger = logging.getLogger("ai-service.guide")

# [Textos fijos por idioma de la interfaz]: Lookup Table | sin LLM → siempre iguales y traducidos
_NO_ANSWER = {
    "es": "No encontré esto en la ayuda de la plataforma. Revisa las preguntas frecuentes en /ayuda/faq o escribe a soporte.",
    "en": "I could not find this in the platform help. Check the FAQ at /ayuda/faq or contact support.",
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
_SUPPORT_NO_ANSWER = {
    "es": "No encontré una solución en la ayuda. Escríbenos desde /ayuda/faq (sección Contacto) con el detalle del problema y una captura; te responderemos.",
    "en": "I could not find a solution in the help. Write to us from /ayuda/faq (Contact section) with the details and a screenshot; we will reply.",
}


class GuideAgent:
    # `mode` (2026-10-19): «guide» orienta sobre el uso · «support» resuelve problemas (mismas fuentes, otro tono) | [Patrón]: Strategy por configuración
    def __init__(self, llm: LLMClient, faq: SearchFaqUseCase, manual: ManualRetriever, manual_threshold: float, mode: str = "guide") -> None:
        self._system = _SUPPORT_SYSTEM if mode == "support" else _SYSTEM
        self._no_answer = _SUPPORT_NO_ANSWER if mode == "support" else _NO_ANSWER
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
        # 1) [FAQ]: coincidencia alta → respuesta aprobada por un ADMIN, tal cual (sin LLM)
        hit = await self._faq.execute(user_input, locale=ctx.locale, role=ctx.role)
        if hit:
            d = hit.doc
            return AgentReply(d.source or d.text, [Source("faq", d.id, d.text, d.topic or None)], "faq")

        # 2) [Manual · RAG]: la ruta actual ayuda a encontrar la sección de esa pantalla
        query = f"{user_input} ({ctx.route})" if ctx.route else user_input
        sections = await self._manual.sections(query, locale=ctx.locale, role=ctx.role, min_score=self._manual_threshold)
        if not sections:
            return AgentReply(self._no_answer[ctx.locale], [], "none")
        sources = [Source("manual", s.id, s.topic, s.kind) for s in sections]

        # 3) [LLM]: solo redacta con lo recuperado | historial corto para preguntas de seguimiento
        numbered = "\n\n".join(f"[{i}] {s.topic}\n{s.source or s.text}" for i, s in enumerate(sections, 1))
        history = "\n".join(f"{m.role}: {m.content}" for m in conversation.last_n(4))
        where = f"Pantalla actual: {ctx.route}\n" if ctx.route else ""
        prompt = f"{where}Secciones del manual:\n{numbered}\n\nConversación previa:\n{history}\n\nPregunta: {user_input}\nRespuesta:"
        try:
            text = (await self._llm.generate(prompt, system=self._system[ctx.locale], max_tokens=350, temperature=0.2)).strip()
        except Exception as exc:  # noqa: BLE001 — LLM caído: la sección más parecida sigue siendo una respuesta verificada
            logger.warning("Agente Guía sin LLM (%s): se devuelve la sección del manual", exc)
            return AgentReply(sections[0].source or sections[0].text, sources[:1], "manual")
        if not text or "NO_SE" in text:
            return AgentReply(self._no_answer[ctx.locale], [], "none")
        return AgentReply(text, sources, "llm")
