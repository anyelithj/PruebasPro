"""RAGRetriever — recupera conocimiento de idiomas del almacén vectorial (Sprint 5.3).

[Patron]: Adapter (VectorStore → lista de textos) + Null Object (sin almacén → sin contexto).
[Principio]: SRP — solo recupera, no genera | DIP — depende del puerto VectorStore, no de FAISS.
[Paradigma]: POO + asíncrono.

[Antes]: stub con 4 frases genéricas de geografía/matemáticas; ahora usa los recursos curriculares aprobados.
[2026-11-13 · Tarea 9 · RF-57]: `references` = búsqueda híbrida filtrada (idioma, nivel, tema) que devuelve 3–5 fragmentos con su
fuente para el bloque REFERENCIAS del tutor, el corrector y la traducción, y deja traza de qué fragmentos se usaron (RNF-35).
"""
import asyncio
import logging
from functools import lru_cache
from pathlib import Path

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc, VectorStore
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

    async def references(
        self,
        query: str,
        *,
        language: str | None = None,
        level: str | None = None,
        theme: str | None = None,
        top_k: int | None = None,
        purpose: str = "rag",
        owner: str | None = None,  # [2026-11-14]: suma las palabras «aprender» de ese usuario (solo las suyas)
    ) -> list[KnowledgeDoc]:
        """Fragmentos para el bloque REFERENCIAS (híbrida + filtros). Lista vacía = no hay material → el modelo debe decirlo.

        `purpose` solo etiqueta la traza (tutor | corrector | traduccion). [ponytail]: la traza va al log estructurado; la respuesta
        HTTP también devuelve los ids para que NestJS los guarde junto a la respuesta.
        """
        if self._store is None or not query.strip():
            return []
        cfg = get_settings()
        k = max(3, min(5, top_k or cfg.rag_top_k))  # 3–5 fragmentos: caben en el contexto del modelo pequeño
        hits = await asyncio.to_thread(
            lambda: self._store.search_scored(query, k, language, cfg.rag_min_score, level=level, theme=theme, hybrid=True, owner=owner)  # type: ignore[union-attr]
        )
        docs = [d for d, _ in hits]
        logger.info("RAG %s: %s", purpose, [(d.id, round(s, 3)) for d, s in hits])  # RNF-35: qué fragmentos respaldaron la respuesta
        return docs


def reference_lines(docs: list[KnowledgeDoc]) -> list[str]:
    """Fragmento + fuente citable («[fuente: …]») para el campo «referencias» del Anexo A. Función pura."""
    return [f"{d.text} [fuente: {d.origin or d.topic or d.resource}]" for d in docs]


@lru_cache(maxsize=1)
def get_rag_retriever() -> RAGRetriever:
    """Singleton compartido por tutor y feedback (un solo índice en memoria). [Patrón]: Factory + Singleton."""
    encoder = get_sentence_transformer()
    if encoder is None:
        logger.warning("RAG sin codificador: el tutor responderá sin contexto curricular")
        return RAGRetriever(None)
    from src.modules.assistant.infrastructure.vector_stores.faiss_store import FaissStore  # Import perezoso: faiss solo si hay codificador

    return RAGRetriever(FaissStore(encoder, Path(get_settings().faiss_index_path)))


async def rag_references(
    query: str, language: str, level: str | None = None, *, theme: str | None = None, purpose: str = "rag"
) -> list[tuple[str, str]]:
    """[Adapter · Tarea 9]: puerto «ReferenceLookup» del corrector y de la traducción → [(id del fragmento, texto con fuente)].

    Un solo adaptador para todos los consumidores (DRY); `functools.partial` fija `theme`/`purpose` en cada composition root.
    """
    docs = await get_rag_retriever().references(query, language=language, level=level, theme=theme, purpose=purpose)
    return list(zip([d.id for d in docs], reference_lines(docs), strict=True))
