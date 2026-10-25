# similarity_search.py (pgvector) => búsqueda ANN por similitud coseno sobre el feature store
# visual. Patrón: Repository·ANN (delegado en shared/util/feature_store: una sola consulta pgvector,
# DRY). Paradigma: asíncrono + funcional (filtro declarativo por umbral).

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.constants.ml_constants import MIN_SIMILARITY
from app.shared.util.feature_store import nearest_products


# search => productos más parecidos a "embedding"; descarta los que no superan MIN_SIMILARITY
# (el índice HNSW siempre devuelve "k" vecinos aunque no se parezcan: el umbral evita ruido)
async def search(session: AsyncSession, embedding: list[float], k: int) -> list[dict[str, Any]]:
    rows = await nearest_products(session, embedding, k)
    return [row for row in rows if row["similarity"] >= MIN_SIMILARITY]
