"""ChatWithAgentUseCase — orquesta repo + agente de la persona pedida.

[Patron]: Command + Use Case + Strategy (AgentFactory elige tutor o guía).
[Principio]: SRP + DIP + OCP (persona nueva = agente nuevo en la fábrica).
[Paradigma]: POO + asincrono.
"""
import uuid
from dataclasses import asdict

from src.modules.assistant.application.schemas.chat_request import ChatRequest
from src.modules.assistant.application.schemas.chat_response import (
    ChatResponse,
    ChatTurn,
    SourceOut,
)
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.value_objects.message import Message
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.infrastructure.agents.agent_factory import AgentFactory
from src.modules.assistant.infrastructure.repositories.conversation_repository import (
    InMemoryConversationRepository,
)


class ChatWithAgentUseCase:
    """Mantiene la conversacion + invoca el agente de la persona."""

    def __init__(
        self,
        repo: InMemoryConversationRepository,
        agents: AgentFactory,
    ) -> None:
        self._repo = repo
        self._agents = agents

    async def execute(self, request: ChatRequest, user_id: str, role: str = "USER") -> ChatResponse:
        # [Cargar o crear conversacion]: una sesion ajena se ignora (nadie continua la conversacion de otro usuario)
        conv: Conversation | None = (
            await self._repo.find(request.session_id) if request.session_id else None
        )
        if conv is None or conv.user_id != user_id:
            conv = Conversation(id=str(uuid.uuid4()), user_id=user_id)

        # [Append user turn + generar respuesta + append assistant turn]
        conv.append(Message.user(request.message))
        context = ScreenContext(route=request.route, role=role, locale=request.locale, level=request.level, game=request.game, dialogue=request.dialogue)
        answer = await self._agents.for_persona(request.persona).reply(conv, request.message, request.language, context)
        conv.append(Message.assistant(answer.text))
        await self._repo.save(conv)

        return ChatResponse(
            session_id=conv.id,
            reply=answer.text,
            history=[
                ChatTurn(role=m.role, content=m.content, timestamp=m.timestamp)
                for m in conv.messages
            ],
            sources=[SourceOut(**asdict(s)) for s in answer.sources],
            answered_by=answer.answered_by,
            # [Sprint 9.6]: el mismo estado del agente va al campo de su persona (partida o conversación con el avatar)
            game=answer.game_state if request.persona == "game" else None,
            dialogue=answer.game_state if request.persona == "dialogue" else None,
        )
