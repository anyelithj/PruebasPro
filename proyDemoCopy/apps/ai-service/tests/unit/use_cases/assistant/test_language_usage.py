"""Tests del uso del idioma meta (2026-10-28): medición por palabras, meta por nivel, aviso de cambio de idioma, petición de reescribir,
modo sin estado (historial de NestJS) y «Soporte y Guía» que NO hace de tutor.

[Patrón]: AAA + Test Double (FakeLLMClient) | [Principio]: Deterministic-first (todo se comprueba sin red ni modelos).
"""

import pytest

from src.modules.assistant.application.schemas.chat_request import ChatRequest, HistoryTurn
from src.modules.assistant.application.use_cases.chat_with_agent import ChatWithAgentUseCase
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.value_objects.language_usage import (
    TARGET_SHARE_BY_LEVEL,
    measure_conversation,
    measure_turn,
    target_share,
)
from src.modules.assistant.domain.value_objects.message import Message
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.infrastructure.agents.agent_factory import AgentFactory
from src.modules.assistant.infrastructure.agents.guide_agent import GuideAgent, is_tutoring_request
from src.modules.assistant.infrastructure.agents.tutor_agent import TutorAgent
from src.modules.assistant.infrastructure.repositories.conversation_repository import InMemoryConversationRepository
from src.modules.feedback.infrastructure.clients.rag_retriever import RAGRetriever
from tests.conftest import FakeLLMClient

_SWITCH = "A partir de tu próximo mensaje, escríbeme en inglés."


def test_tabla_de_metas_por_nivel() -> None:
    assert dict(TARGET_SHARE_BY_LEVEL) == {"A1": 0.3, "A2": 0.4, "B1": 0.6, "B2": 0.75, "C1": 0.9, "C2": 1.0}
    assert target_share(None) == 0.6 and target_share("zz") == 0.6  # Sin nivel → B1


def test_mide_palabras_por_fragmento() -> None:
    assert measure_turn("el presente simple", "en").target_words == 0
    assert measure_turn("I like to play football every day", "en").share == 1.0
    mixed = measure_turn("I go to school. Pero no sé el resto", "en")
    assert (mixed.words, mixed.target_words) == (9, 4)


def test_solo_cuenta_despues_del_aviso() -> None:
    msgs = [Message.user("el presente simple"), Message.assistant(f"Regla… {_SWITCH}"), Message.user("I play football")]
    usage = measure_conversation(msgs, "en", "A2")
    assert (usage.turns, usage.ratio, usage.target, usage.announced, usage.below) == (1, 1.0, 0.4, True, False)
    assert measure_conversation(msgs[:1], "en", "A2").turns == 0  # Antes del aviso no penaliza


async def test_el_tutor_avisa_cuando_cambiar_de_idioma() -> None:
    # [Bug 2026-10-28]: «el presente simple» → explicación en español sin decir nunca cuándo pasar al inglés
    llm = FakeLLMClient(reply="El presente simple: I play = yo juego. Completa: She ___ (play) tennis.")
    conv = Conversation("c", "u")
    conv.append(Message.user("el presente simple"))
    r = await TutorAgent(llm, RAGRetriever(None)).reply(conv, "el presente simple", "en", ScreenContext(None, "USER", level="B1"))
    assert "a partir de tu próximo mensaje, intenta escribirme en inglés" in r.text and "60 %" in r.text
    assert r.language_usage is not None and r.language_usage.turns == 0


async def test_pide_reescribir_si_no_llega_a_la_meta() -> None:
    llm = FakeLLMClient(reply="En inglés: «I want to eat pizza».")
    conv = Conversation("c", "u")
    for m in (Message.user("el presente simple"), Message.assistant(f"Regla. {_SWITCH}"), Message.user("quiero comer pizza hoy")):
        conv.append(m)
    r = await TutorAgent(llm, RAGRetriever(None)).reply(conv, "quiero comer pizza hoy", "en", ScreenContext(None, "USER", level="A2"))
    assert "Reescribe tu último mensaje en inglés" in r.text and "meta 40 %" in r.text
    assert "A partir de tu próximo mensaje" not in r.text  # El aviso no se repite
    assert r.language_usage is not None and r.language_usage.below
    assert "no lances un reto nuevo" in llm.calls[0]["prompt"]


async def test_no_pide_reescribir_si_cumple() -> None:
    llm = FakeLLMClient(reply="✓ Bien. Next: she ___ (go).")
    conv = Conversation("c", "u")
    for m in (Message.user("present simple"), Message.assistant(f"Regla. {_SWITCH}"), Message.user("She plays tennis every day")):
        conv.append(m)
    r = await TutorAgent(llm, RAGRetriever(None)).reply(conv, "She plays tennis every day", "en", ScreenContext(None, "USER", level="C1"))
    assert "Reescribe" not in r.text and r.language_usage is not None and not r.language_usage.below


async def test_modo_sin_estado_usa_el_historial_y_no_guarda() -> None:
    repo, llm = InMemoryConversationRepository(), FakeLLMClient(reply="ok")
    use_case = ChatWithAgentUseCase(repo, AgentFactory({"tutor": TutorAgent(llm, RAGRetriever(None))}))
    req = ChatRequest(
        session_id="11111111-1111-1111-1111-111111111111",
        message="I play football",
        language="en",
        level="A1",
        history=[HistoryTurn(role="user", content="el presente simple"), HistoryTurn(role="assistant", content=f"Regla. {_SWITCH}")],
    )
    resp = await use_case.execute(req, "u1")
    assert resp.session_id == req.session_id and len(resp.history) == 4
    assert resp.language_usage is not None and resp.language_usage.ratio == 1.0 and resp.language_usage.target == 0.3
    assert await repo.find(req.session_id) is None  # El dueño del historial es NestJS


@pytest.mark.parametrize("text", ["el presente simple", "¿Cómo se dice perro?", "quiero practicar inglés", "what does cheers mean"])
def test_detecta_peticiones_de_tutoria(text: str) -> None:
    assert is_tutoring_request(text)


@pytest.mark.parametrize("text", ["¿Dónde está el traductor?", "mi banco de vocabulario no carga", "No puedo pagar con tarjeta"])
def test_no_desvia_preguntas_de_la_plataforma(text: str) -> None:
    assert not is_tutoring_request(text)


async def test_soporte_no_hace_de_tutor() -> None:
    llm = FakeLLMClient()
    faq, manual = object(), object()  # No se deben tocar: la guarda responde antes
    agent = GuideAgent(llm, faq, manual, 0.35, mode="support")  # type: ignore[arg-type]
    r = await agent.reply(Conversation("c", "u"), "el presente simple", context=ScreenContext("/tutor", "USER"))
    assert "Tutor IA" in r.text and "no doy clases" in r.text and r.answered_by == "none" and llm.calls == []
