"""Tests de ChatWithAgentUseCase — repo in-memory + agente (mockeado)."""
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.modules.assistant.application.schemas.chat_request import ChatRequest
from src.modules.assistant.application.use_cases.chat_with_agent import (
    ChatWithAgentUseCase,
)
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.agent import AgentReply
from src.modules.assistant.domain.value_objects.message import Message
from src.modules.assistant.infrastructure.agents.agent_factory import AgentFactory
from src.modules.assistant.infrastructure.repositories.conversation_repository import (
    InMemoryConversationRepository,
)


def _agents(agent: MagicMock) -> AgentFactory:
    """[Sprint 7.9]: el caso de uso recibe la fábrica de agentes (tutor y guía usan el mismo doble)."""
    return AgentFactory({"tutor": agent, "guide": agent})


class TestChatWithAgent:
    @pytest.mark.asyncio
    async def test_nueva_conversacion_sin_session(self) -> None:
        # [Sin session_id]: crea una conversacion nueva con uuid
        repo = InMemoryConversationRepository()
        agent = MagicMock()
        agent.reply = AsyncMock(return_value=AgentReply("Hola estudiante"))

        use_case = ChatWithAgentUseCase(repo=repo, agents=_agents(agent))
        resp = await use_case.execute(ChatRequest(message="hola"), user_id="u1")

        assert resp.reply == "Hola estudiante"
        # [Historia]: turno usuario + turno asistente
        assert len(resp.history) == 2
        assert resp.history[0].role == "user"
        assert resp.history[1].role == "assistant"
        # [Persistencia]: la conversacion quedo guardada
        saved = await repo.find(resp.session_id)
        assert saved is not None
        assert saved.user_id == "u1"

    @pytest.mark.asyncio
    async def test_continua_conversacion_existente(self) -> None:
        repo = InMemoryConversationRepository()
        existing = Conversation(id="s1", user_id="u1")
        existing.append(Message.user("primer mensaje"))
        existing.append(Message.assistant("primera respuesta"))
        await repo.save(existing)

        agent = MagicMock()
        agent.reply = AsyncMock(return_value=AgentReply("segunda respuesta"))

        use_case = ChatWithAgentUseCase(repo=repo, agents=_agents(agent))
        resp = await use_case.execute(
            ChatRequest(session_id="s1", message="segundo mensaje"), user_id="u1"
        )

        assert resp.session_id == "s1"
        # [Historia acumulada]: 2 previos + user + assistant = 4
        assert len(resp.history) == 4
        assert resp.history[-1].content == "segunda respuesta"

    @pytest.mark.asyncio
    async def test_session_inexistente_crea_nueva(self) -> None:
        # [session_id que no existe en repo]: se crea conversacion nueva
        repo = InMemoryConversationRepository()
        agent = MagicMock()
        agent.reply = AsyncMock(return_value=AgentReply("r"))

        use_case = ChatWithAgentUseCase(repo=repo, agents=_agents(agent))
        resp = await use_case.execute(
            ChatRequest(session_id="no-existe", message="hola"), user_id="u1"
        )
        # [Defecto-no]: el id generado difiere del session_id pedido (se ignora)
        assert resp.session_id != "no-existe"
        assert len(resp.history) == 2

    @pytest.mark.asyncio
    async def test_invoca_agente_con_mensaje(self) -> None:
        repo = InMemoryConversationRepository()
        agent = MagicMock()
        agent.reply = AsyncMock(return_value=AgentReply("r"))

        await ChatWithAgentUseCase(repo=repo, agents=_agents(agent)).execute(
            ChatRequest(message="explica fracciones"), user_id="u1"
        )
        # [Verifica]: el agente recibe el texto del usuario
        args, _ = agent.reply.call_args
        assert args[1] == "explica fracciones"

    @pytest.mark.asyncio
    async def test_sesion_de_otro_usuario_no_se_continua(self) -> None:
        # [Seguridad · Sprint 7.9]: con el session_id ajeno se abre una conversación nueva (no se lee el historial de otro)
        repo = InMemoryConversationRepository()
        await repo.save(Conversation(id="s1", user_id="otro"))
        agent = MagicMock()
        agent.reply = AsyncMock(return_value=AgentReply("r"))
        resp = await ChatWithAgentUseCase(repo=repo, agents=_agents(agent)).execute(ChatRequest(session_id="s1", message="hola"), user_id="u1")
        assert resp.session_id != "s1"

    @pytest.mark.asyncio
    async def test_persona_guia_recibe_contexto_y_devuelve_fuentes(self) -> None:
        from src.modules.assistant.domain.interfaces.agent import Source

        tutor, guide = MagicMock(), MagicMock()
        tutor.reply = AsyncMock(return_value=AgentReply("tutor"))
        guide.reply = AsyncMock(return_value=AgentReply("Ve a Cursos.", [Source("faq", "f1", "¿Dónde están mis cursos?", "cursos")], "faq"))
        use_case = ChatWithAgentUseCase(InMemoryConversationRepository(), AgentFactory({"tutor": tutor, "guide": guide}))
        resp = await use_case.execute(ChatRequest(message="¿mis cursos?", persona="guide", route="/courses", locale="en"), user_id="u1", role="TEACHER")
        assert resp.answered_by == "faq" and resp.sources[0].ref == "cursos"
        context = guide.reply.call_args.args[3]
        assert (context.route, context.role, context.locale) == ("/courses", "TEACHER", "en")  # El rol viene del token
        tutor.reply.assert_not_called()
