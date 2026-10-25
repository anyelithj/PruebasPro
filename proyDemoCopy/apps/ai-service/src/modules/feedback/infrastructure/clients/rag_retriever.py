"""RAGRetriever — recupera conocimiento de idiomas del almacén vectorial (Sprint 5.3).

[Patron]: Adapter (VectorStore → lista de textos) + Null Object (sin almacén → sin contexto).
[Principio]: SRP — solo recupera, no genera | DIP — depende del puerto VectorStore, no de FAISS.
[Paradigma]: POO + asíncrono.

[Antes]: stub con 4 frases genéricas de geografía/matemáticas; ahora usa los recursos curriculares aprobados.
"""
import asyncio
import logging
from functools import lru_cache
from pathlib import Path

from src.modules.assistant.domain.interfaces.vector_store import VectorStore
from src.shared.config.settings import get_settings
from src.shared.dependencies.model_deps import get_sentence_transformer

logger = logging.getLogger("ai-service.rag")


class RAGRetriever:
    def __init__(self, store: VectorStore | None) -> None:
        self._store = store  # None = codificador no disponible → el tutor responde sin contexto

    @property
    def store(self) -> VectorStore | None:
        return self._store

    # `min_score` (0..1): parecido mínimo; el tutor pide uno alto para no mezclar material que no tiene que ver con la pregunta
    async def retrieve(
        self, query: str, *, top_k: int = 3, language: str | None = None, min_score: float = 0.3
    ) -> list[str]:
        if self._store is None:
            return []
        # [Hilo aparte]: codificar la consulta usa CPU (torch) → no bloquea el event loop
        hits = await asyncio.to_thread(self._store.search_scored, query, top_k, language, min_score)
        return [d.text for d, _ in hits]


@lru_cache(maxsize=1)
def get_rag_retriever() -> RAGRetriever:
    """Singleton compartido por tutor y feedback (un solo índice en memoria). [Patrón]: Factory + Singleton."""
    encoder = get_sentence_transformer()
    if encoder is None:
        logger.warning("RAG sin codificador: el tutor responderá sin contexto curricular")
        return RAGRetriever(None)
    from src.modules.assistant.infrastructure.vector_stores.faiss_store import FaissStore  # Import perezoso: faiss solo si hay codificador

    return RAGRetriever(FaissStore(encoder, Path(get_settings().faiss_index_path)))
