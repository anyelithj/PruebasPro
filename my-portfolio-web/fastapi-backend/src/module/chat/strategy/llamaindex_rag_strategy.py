"""[STRATEGY][OCP] RAG sobre el portafolio vía LlamaIndex + pgvector + Ollama.

Recupera proyectos/CV/blog indexados y responde citando la fuente exacta.
Se apoya en VectorStoreService (infra). Import perezoso de LlamaIndex.
"""

from collections.abc import AsyncGenerator

from src.module.chat.dto.chat_event_dto import ChatEventDto
from src.module.chat.strategy.ai_provider_interface import (
    AiProviderInterface,
    ChatHistory,
)


class LlamaIndexRagStrategy(AiProviderInterface):
    @property
    def name(self) -> str:
        return "rag"

    async def stream(
        self, message: str, history: ChatHistory
    ) -> AsyncGenerator[ChatEventDto, None]:
        try:
            from src.infrastructure.vector_store.vector_store_service import (
                VectorStoreService,
            )
        except ImportError as exc:  # pragma: no cover
            yield ChatEventDto.error("Dependencias RAG (llama-index) no instaladas")
            raise RuntimeError("llama-index missing") from exc

        service = VectorStoreService()
        try:
            engine = await service.get_query_engine()
        except Exception as exc:  # noqa: BLE001
            yield ChatEventDto.error(f"Índice RAG no disponible: {exc}")
            yield ChatEventDto.done()
            return

        response = await engine.aquery(message)

        # Emite las fuentes citadas antes/junto al texto.
        for node in getattr(response, "source_nodes", []) or []:
            src = node.metadata.get("file_name") or node.metadata.get("source")
            if src:
                yield ChatEventDto.from_source(str(src))

        text = str(response)
        # Emite en pequeños fragmentos para simular streaming palabra a palabra.
        for word in text.split(" "):
            yield ChatEventDto.chunk(word + " ")
        yield ChatEventDto.done()
