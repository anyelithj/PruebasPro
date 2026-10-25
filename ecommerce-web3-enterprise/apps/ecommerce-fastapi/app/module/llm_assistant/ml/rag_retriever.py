# rag_retriever.py (pgvector + embeddings de Ollama) => recuperación semántica para el asistente
# (Plan 5B.2): top-k fragmentos de ml.knowledge_chunks por distancia coseno (índice HNSW, ANN) con
# filtros por metadatos (idioma, fuente, categoría). Si el índice aún está vacío usa como fallback
# el RAG FAISS del catálogo ya registrado en natural_language (rag_pipeline.py, DRY).
# Patrón: Strategy (pgvector principal / FAISS fallback, misma salida) + Repository (consulta ANN
# encapsulada) + Value Object (Source). Paradigma: asíncrono + funcional.
# Ahorro de recursos: una sola consulta SQL con LIMIT k (no recorre la tabla) y fragmentos cortos
# (menos tokens de contexto que procesar por respuesta).

from dataclasses import asdict, dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.llm_config import get_llm_settings
from app.module.natural_language.ml import rag_pipeline
from app.module.natural_language.ml.llm_connector import embed
from app.shared.util.feature_store import to_literal
from app.shared.util.model_cache import ModelUnavailableError, run_model

ENGINE = "de embeddings (Ollama)"
# Solo fragmentos a menos de 0.08 del mejor puntaje: con granite los no relacionados también puntúan
# alto (~0.65–0.78), y cada fragmento de más son tokens que el LLM procesa sin aportar
SCORE_MARGIN = 0.08

# "<=>" => distancia coseno de pgvector; "1 - distancia" = similitud. Los productos no se filtran
# por idioma (el catálogo está en español y el embedding es multilingüe: una pregunta en inglés
# también los encuentra)
SEARCH_SQL = text("""
    SELECT id, source, title, content, 1 - (embedding <=> CAST(:query AS vector)) AS score
    FROM ml.knowledge_chunks
    WHERE (CAST(:lang AS text) IS NULL OR lang = :lang OR source = 'product')
      AND (CAST(:source AS text) IS NULL OR source = :source)
      AND (CAST(:category AS text) IS NULL OR category = :category)
    ORDER BY embedding <=> CAST(:query AS vector)
    LIMIT :k
""")
HAS_CHUNKS_SQL = text("SELECT EXISTS (SELECT 1 FROM ml.knowledge_chunks)")


# Source => fragmento recuperado (lo que entra al prompt y lo que se cita en la respuesta)
@dataclass(frozen=True)
class Source:
    id: str
    source: str
    title: str
    content: str
    score: float

    def citation(self) -> dict:  # Lo que se guarda en LlmMessage.sources (sin el texto)
        return {k: v for k, v in asdict(self).items() if k != "content"}


async def retrieve(
    session: AsyncSession,
    query: str,
    lang: str | None = None,
    source: str | None = None,
    category: str | None = None,
) -> list[Source]:
    settings = get_llm_settings()
    try:
        vector = (await run_model(embed, [query], engine=ENGINE))[0]
        params = {
            "query": to_literal(vector.tolist()),
            "lang": lang,
            "source": source,
            "category": category,
            "k": settings.RAG_TOP_K,
        }
        rows = (await session.execute(SEARCH_SQL, params)).mappings().all()
        if not rows and not (await session.execute(HAS_CHUNKS_SQL)).scalar_one():
            return await _faiss_fallback(session, query)
    except ModelUnavailableError:  # Sin modelo de embeddings el chat responde sin contexto
        return []
    cutoff = max(settings.RAG_MIN_SIMILARITY, rows[0]["score"] - SCORE_MARGIN) if rows else 1
    return [
        Source(row["id"], row["source"], row["title"], row["content"], round(row["score"], 4))
        for row in rows
        if row["score"] >= cutoff
    ]


# _faiss_fallback => índice vacío (aún no se ejecutó POST /knowledge/index): catálogo vía FAISS
async def _faiss_fallback(session: AsyncSession, query: str) -> list[Source]:
    settings = get_llm_settings()
    docs = await rag_pipeline.retrieve(session, query, settings.RAG_TOP_K)
    return [
        Source(doc["product_id"], "product", doc["text"][:80], doc["text"], doc["score"])
        for doc in docs
        if doc["score"] >= settings.RAG_MIN_SIMILARITY
    ]
