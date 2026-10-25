"""[FACADE][SRP] orquesta IA + historial — no toca HTTP directamente.

Flujo: persiste el mensaje del usuario → streamea la respuesta del provider →
acumula los chunks → persiste la respuesta del asistente al terminar.
"""

import logging
from collections.abc import AsyncGenerator

from src.module.chat.dto.chat_event_dto import ChatEventDto, ChatEventType
from src.module.chat.dto.send_message_dto import SendMessageDto
from src.module.chat.model.message_model import MessageModel
from src.module.chat.repository.chat_repository import ChatRepository
from src.module.chat.service.ai_provider_service import AiProviderService

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(
        self, repository: ChatRepository, providers: AiProviderService
    ) -> None:
        self._repository = repository
        self._providers = providers

    async def history(self, session_id: str) -> list[MessageModel]:
        return await self._repository.history(session_id)

    async def stream(
        self, dto: SendMessageDto, user_id: str | None = None
    ) -> AsyncGenerator[ChatEventDto, None]:
        # 1. Persistir el mensaje del usuario.
        await self._repository.add(
            MessageModel(
                session_id=dto.session_id,
                role="user",
                content=dto.content,
                user_id=user_id,
            )
        )

        # 2. Recuperar historial como contexto para el modelo.
        history = [
            (m.role, m.content)
            for m in await self._repository.history(dto.session_id)
        ]

        provider = self._providers.get(dto.provider)
        buffer: list[str] = []

        # 3. Streamear la respuesta y reenviar cada evento al cliente.
        try:
            async for event in provider.stream(dto.content, history):
                if event.type is ChatEventType.CHUNK:
                    buffer.append(event.content)
                yield event
        except Exception as exc:  # noqa: BLE001
            logger.error("Chat stream failed: %s", exc)
            yield ChatEventDto.error("La generación falló, intenta de nuevo")

        # 4. Persistir la respuesta completa del asistente.
        answer = "".join(buffer).strip()
        if answer:
            await self._repository.add(
                MessageModel(
                    session_id=dto.session_id,
                    role="assistant",
                    content=answer,
                    user_id=user_id,
                )
            )
