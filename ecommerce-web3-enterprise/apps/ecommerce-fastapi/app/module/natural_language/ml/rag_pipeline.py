# rag_pipeline.py (FAISS + embeddings de Ollama) => Retrieval-Augmented Generation: recupera los
# productos del catálogo más relacionados con la pregunta para darle contexto real al LLM (menos
# alucinación: el modelo responde sobre productos que existen).
# Patrón: Pipeline (catálogo -> embeddings -> índice FAISS -> top-k) + Cache con TTL (el índice se
# reconstruye como máximo una vez por hora). Paradigma: asíncrono (lectura SQL) + funcional
# (búsqueda). Ahorro de recursos: índice en memoria del proceso (sin servidor vectorial extra); el
# catálogo se embebe por lotes una sola vez por hora, no en cada pregunta.

import time
from dataclasses import dataclass
from typing import Any

import faiss  # FAISS (Meta): búsqueda de vecinos por producto interno, en C++
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.natural_language.ml.llm_connector import embed
from app.shared.util.model_cache import run_model

INDEX_TTL_SECONDS = 3600
CATALOG_SQL = text("""
    SELECT id, name, description, "minPriceCents" AS price_cents, currency
    FROM public.products WHERE status = 'ACTIVE' ORDER BY "updatedAt" DESC LIMIT 5000
""")


# CatalogIndex => Value Object: índice FAISS + documentos alineados por posición
@dataclass(frozen=True)
class CatalogIndex:
    index: Any
    documents: list[dict[str, Any]]
    built_at: float


_cache: dict[str, CatalogIndex] = {}  # Singleton de módulo: un índice por proceso


def _document(row: Any) -> dict[str, Any]:
    price = f"{row.price_cents / 100:,.0f} {row.currency}"
    return {
        "product_id": row.id,
        "text": f"{row.name}. {row.description[:400]} Precio desde {price}.",
    }


def build_index(documents: list[dict[str, Any]]) -> CatalogIndex:
    vectors = embed([doc["text"] for doc in documents])
    index = faiss.IndexFlatIP(vectors.shape[1])  # Producto interno = coseno (vectores con norma 1)
    index.add(vectors)
    return CatalogIndex(index=index, documents=documents, built_at=time.monotonic())


async def _catalog_index(session: AsyncSession) -> CatalogIndex | None:
    current = _cache.get("catalog")
    if current and time.monotonic() - current.built_at < INDEX_TTL_SECONDS:
        return current
    documents = [_document(row) for row in (await session.execute(CATALOG_SQL)).all()]
    if not documents:  # Catálogo vacío: el chat responde sin contexto
        return None
    _cache["catalog"] = await run_model(build_index, documents, engine="de lenguaje (Ollama)")
    return _cache["catalog"]


def search(index: CatalogIndex, query: str, k: int) -> list[dict[str, Any]]:
    scores, positions = index.index.search(embed([query]), min(k, len(index.documents)))
    return [
        index.documents[p] | {"score": round(float(s), 4)}
        for s, p in zip(scores[0], positions[0], strict=True)
    ]


# retrieve => top-k documentos del catálogo para "query" (lista vacía si no hay catálogo)
async def retrieve(session: AsyncSession, query: str, k: int = 3) -> list[dict[str, Any]]:
    index = await _catalog_index(session)
    return (
        []
        if index is None
        else await run_model(search, index, query, k, engine="de lenguaje (Ollama)")
    )
