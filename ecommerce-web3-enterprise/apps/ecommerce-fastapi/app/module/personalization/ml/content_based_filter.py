# content_based_filter.py (CLIP + pgvector) => recomendación por contenido: el perfil del usuario es
# el promedio de los embeddings visuales CLIP de los productos con los que interactuó, y se buscan
# los productos más parecidos en el feature store (índice HNSW). Funciona aunque el producto sea
# nuevo (sin interacciones de nadie): resuelve el arranque en frío del filtrado colaborativo.
# Patrón: Strategy. Paradigma: asíncrono + funcional. Reutiliza feature_store (DRY).

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.util.feature_store import nearest_products, product_embedding


async def recommend(session: AsyncSession, seen_products: list[str], k: int) -> dict[str, float]:
    # Últimos 20
    vectors = [v for pid in seen_products[-20:] if (v := await product_embedding(session, pid))]
    if not vectors:
        return {}
    profile = np.mean(vectors, axis=0)
    profile = (profile / np.linalg.norm(profile)).tolist()
    rows = await nearest_products(session, profile, k + len(seen_products))
    seen = set(seen_products)
    return {
        row["product_id"]: float(row["similarity"]) for row in rows if row["product_id"] not in seen
    }
