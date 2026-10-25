"""[STRATEGY][OCP] chat directo vía LangChain + Ollama (Qwen2.5) — sin API keys.

langchain-ollama se importa de forma perezosa: la app arranca aunque el paquete
no esté instalado; solo al usar el chat se exige la dependencia.
"""

from collections.abc import AsyncGenerator

from src.config.ai_config import get_ai_config
from src.module.chat.dto.chat_event_dto import ChatEventDto
from src.module.chat.strategy.ai_provider_interface import (
    AiProviderInterface,
    ChatHistory,
)

_SYSTEM_PROMPT = (
    "Eres el asistente del portafolio de Anghelo. Responde de forma clara, "
    "concisa y amable en el idioma del usuario. No inventes datos."
)


class OllamaLangChainStrategy(AiProviderInterface):
    @property
    def name(self) -> str:
        return "ollama"

    async def stream(
        self, message: str, history: ChatHistory
    ) -> AsyncGenerator[ChatEventDto, None]:
        try:
            from langchain_ollama import ChatOllama  # import perezoso
        except ImportError as exc:  # pragma: no cover
            yield ChatEventDto.error(
                "langchain-ollama no instalado: `poetry add langchain-ollama`"
            )
            raise RuntimeError("langchain-ollama missing") from exc

        cfg = get_ai_config()
        llm = ChatOllama(
            base_url=cfg.base_url,
            model=cfg.chat_model,
            temperature=cfg.temperature,
        )

        messages: list[tuple[str, str]] = [("system", _SYSTEM_PROMPT)]
        messages.extend((role, content) for role, content in history)
        messages.append(("human", message))

        async for chunk in llm.astream(messages):
            text = getattr(chunk, "content", "")
            if text:
                yield ChatEventDto.chunk(text)
        yield ChatEventDto.done()
