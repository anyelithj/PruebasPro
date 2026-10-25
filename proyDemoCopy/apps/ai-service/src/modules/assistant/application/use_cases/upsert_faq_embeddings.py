"""UpsertFaqEmbeddingsUseCase — reconstruye el índice de FAQ con las publicadas que envía NestJS (Sprint 7.9 · RF-97).

[Patrón]: Command + Use Case + Mapper (FAQ → KnowledgeDoc).
[Principio]: SRP + DIP + SSOT (la FAQ vive en la tabla de NestJS; aquí solo su índice, reconstruible en cualquier momento).
[Paradigma]: POO + asíncrono.
[Por qué reconstruir entero]: pocas decenas de FAQ → recodificar todo es simple, rápido y nunca deja entradas archivadas colgando.
"""

import asyncio

from pydantic import BaseModel, ConfigDict, Field

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc, VectorStore


class FaqIn(BaseModel):
    """FAQ publicada tal como la manda NestJS Help. [Patrón]: DTO."""

    model_config = ConfigDict(frozen=True, extra="ignore")
    id: str
    question: str = Field(..., min_length=3, max_length=300)
    answer: str = Field(..., min_length=1, max_length=4000)
    category: str
    role: str = "ALL"  # ALL | USER | TEACHER | ADMIN
    locale: str = "es"
    manual_slug: str | None = None


class UpsertFaqEmbeddingsUseCase:
    def __init__(self, store: VectorStore) -> None:
        self._store = store

    async def execute(self, faqs: list[FaqIn]) -> dict[str, object]:
        docs = [KnowledgeDoc(f.id, f.locale, f.role, "faq", f.manual_slug or "", f.question, f.answer) for f in faqs]
        indexed = await asyncio.to_thread(self._store.rebuild, docs)  # Codificar es CPU → hilo aparte
        return {"indexed": indexed}
