"""FaqRetriever — búsqueda semántica de las FAQ publicadas (Sprint 7.9).

[Patrón]: Adapter (VectorStore → aciertos con puntuación) + Null Object (sin codificador → sin aciertos) + Singleton (`lru_cache`).
[Principio]: SRP (solo recupera) + DIP (depende del puerto VectorStore, no de FAISS) + DRY (mismo FaissStore y codificador que el tutor, otro directorio).
[Paradigma]: POO + asíncrono.

Mapeo FAQ → KnowledgeDoc: text = pregunta (lo que se codifica) · source = respuesta · topic = slug del artículo del manual · level = rol (ALL | USER | TEACHER | ADMIN) · language = es | en.
"""

import asyncio
from functools import lru_cache
from pathlib import Path

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc, VectorStore
from src.shared.config.settings import get_settings
from src.shared.dependencies.model_deps import get_sentence_transformer


def visible_to(doc: KnowledgeDoc, role: str) -> bool:
    """FAQ y manual: «ALL» lo ve cualquiera; ADMIN lo ve todo; el resto solo lo de su rol. [Patrón]: Policy (función pura)."""
    return doc.level in ("ALL", role) or role == "ADMIN"


class FaqRetriever:
    def __init__(self, store: VectorStore | None) -> None:
        self._store = store

    @property
    def store(self) -> VectorStore | None:
        return self._store

    async def search(self, query: str, *, locale: str, role: str, min_score: float, top_k: int = 3) -> list[tuple[KnowledgeDoc, float]]:
        if self._store is None:
            return []
        # [Hilo aparte]: codificar la consulta usa CPU · se piden más candidatos porque el rol se filtra después
        hits = await asyncio.to_thread(self._store.search_scored, query, top_k * 4, locale, min_score)
        return [(d, s) for d, s in hits if visible_to(d, role)][:top_k]


def _store(name: str) -> VectorStore | None:
    """Índice FAISS propio en `<faiss_index_path>/<name>` (FAQ y manual no se mezclan con el currículo del tutor)."""
    encoder = get_sentence_transformer()
    if encoder is None:
        return None
    from src.modules.assistant.infrastructure.vector_stores.faiss_store import FaissStore  # Import perezoso: faiss solo si hay codificador

    return FaissStore(encoder, Path(get_settings().faiss_index_path) / name)


@lru_cache(maxsize=1)
def get_faq_retriever() -> FaqRetriever:
    return FaqRetriever(_store("faq"))
