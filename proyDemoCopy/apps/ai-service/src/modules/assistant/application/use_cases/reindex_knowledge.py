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


class ChangedKnowledgeSource(Protocol):  # [Port]: fragmentos actuales de unos recursos (vacío si se borraron o ya no son indexables)
    async def docs_for(self, resource_ids: list[str]) -> list[KnowledgeDoc]: ...


class SyncKnowledgeUseCase:
    """[Tarea 9 · RF-57]: NestJS avisa qué recursos cambiaron (alta manual, importación por archivo o enlace, edición, revisión o baja)
    y el índice reemplaza sus fragmentos → nunca quedan fragmentos huérfanos ni desactualizados.

    [Patrón]: Command + Use Case | [Principio]: SSOT (se relee la BD: NestJS solo manda ids, no texto que pueda divergir) + idempotente.
    """

    def __init__(self, source: ChangedKnowledgeSource, store: VectorStore) -> None:
        self._source = source
        self._store = store

    async def execute(self, resource_ids: list[str]) -> dict[str, object]:
        ids = list(dict.fromkeys(resource_ids))  # `dict.fromkeys`: sin repetidos y en orden
        docs = await self._source.docs_for(ids)
        indexed = await asyncio.to_thread(self._store.replace_resources, ids, docs)  # Codificar es CPU → hilo aparte
        present = {d.resource for d in docs}
        return {"indexed": indexed, "removed": [i for i in ids if i not in present], "size": self._store.size}
