"""ManualRetriever — RAG sobre las secciones del manual de usuario (Sprint 7.9).

[Patrón]: Adapter (VectorStore → secciones citables) + Singleton (`lru_cache`) + herencia de FaqRetriever (misma búsqueda y política de rol).
[Principio]: SRP + DIP + DRY (no repite la búsqueda; solo cambia la forma del resultado).
[Paradigma]: POO + asíncrono.

Mapeo sección → KnowledgeDoc: id = «slug#ancla» · text = «título del artículo · sección: cuerpo» (lo que se codifica) · source = cuerpo · topic = título de la sección · kind = slug del artículo.
"""

from functools import lru_cache

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc
from src.modules.assistant.infrastructure.clients.faq_retriever import FaqRetriever, _store


class ManualRetriever(FaqRetriever):
    async def sections(self, query: str, *, locale: str, role: str, min_score: float, top_k: int = 3) -> list[KnowledgeDoc]:
        return [d for d, _ in await self.search(query, locale=locale, role=role, min_score=min_score, top_k=top_k)]


@lru_cache(maxsize=1)
def get_manual_retriever() -> ManualRetriever:
    return ManualRetriever(_store("manual"))
