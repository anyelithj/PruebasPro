"""ReindexKnowledgeUseCase — reconstruye el índice del tutor desde los recursos aprobados (Sprint 5.3).

[Patron]: Command + Use Case.
[Principio]: SRP + DIP (repositorio y almacén llegan inyectados).
[Paradigma]: POO + asíncrono.
"""
import asyncio
from typing import Protocol

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc, VectorStore


class KnowledgeSource(Protocol):
    async def approved_docs(self) -> list[KnowledgeDoc]: ...


class ReindexKnowledgeUseCase:
    def __init__(self, source: KnowledgeSource, store: VectorStore) -> None:
        self._source = source
        self._store = store

    async def execute(self) -> dict[str, object]:
        docs = await self._source.approved_docs()
        indexed = await asyncio.to_thread(self._store.rebuild, docs)  # Codificar es CPU → hilo aparte
        by_language: dict[str, int] = {}
        for d in docs:
            by_language[d.language] = by_language.get(d.language, 0) + 1
        return {"indexed": indexed, "by_language": by_language}
