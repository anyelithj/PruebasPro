"""SearchFaqUseCase — mejor FAQ para una pregunta, solo si supera el umbral (Sprint 7.9 · RF-96, paso 1).

[Patrón]: Query + Use Case.
[Principio]: SRP + DIP (recibe el retriever) + Deterministic-first (si la FAQ alcanza, el LLM no se usa).
[Paradigma]: POO + asíncrono.
"""

from dataclasses import dataclass

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc
from src.modules.assistant.infrastructure.clients.faq_retriever import FaqRetriever


@dataclass(frozen=True)
class FaqHit:
    doc: KnowledgeDoc
    score: float  # Similitud coseno 0..1


class SearchFaqUseCase:
    def __init__(self, retriever: FaqRetriever, threshold: float) -> None:
        self._retriever = retriever
        self._threshold = threshold  # settings.guide_faq_threshold

    async def execute(self, question: str, *, locale: str, role: str) -> FaqHit | None:
        hits = await self._retriever.search(question, locale=locale, role=role, min_score=self._threshold, top_k=1)
        return FaqHit(*hits[0]) if hits else None
