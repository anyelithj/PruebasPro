# feature_store.py (SQLAlchemy + pgvector) => almacén de features vectoriales compartido por los
# módulos ML: embeddings visuales CLIP de productos (ml.image_embeddings) con índice HNSW.
# Lo usan image_recognition (búsqueda visual, Sprint 5.2) y ml_prediction (arranque en frío por
# productos visualmente similares, Sprint 5.1).
# Patrón: Repository (consultas ANN encapsuladas) + Adapter (tipo Vector: list[float] <-> vector).
# Paradigma: asíncrono (await) + funcional (funciones sin estado).
# El tipo Vector son ~10 líneas con la API de tipos de SQLAlchemy: evita sumar la dependencia
# "pgvector".

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import UserDefinedType  # Base para tipos nativos que SQLAlchemy no trae


# Vector => columna "vector(N)" de pgvector. Se envía como texto "[0.1,0.2,...]" (formato de entrada
# de pgvector) y se lee igual; asyncpg no trae codec para este tipo y lo entrega como str.
class Vector(UserDefinedType):
    cache_ok = True  # El tipo es inmutable: SQLAlchemy puede cachear las sentencias que lo usan

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def get_col_spec(self, **_: Any) -> str:
        return f"vector({self.dim})"

    def bind_processor(self, dialect: Any):  # Python -> BD
        return lambda value: None if value is None else to_literal(value)

    def result_processor(self, dialect: Any, coltype: Any):  # BD -> Python
        return lambda value: None if value is None else from_literal(value)


def to_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in vector) + "]"  # 6 decimales: precisión de sobra


def from_literal(value: str) -> list[float]:
    return [float(x) for x in value.strip("[]").split(",")]


# "<=>" => distancia coseno de pgvector; ORDER BY con LIMIT usa el índice HNSW (ANN: no recorre la
# tabla)
NEAREST_SQL = text("""
    SELECT id, product_id, labels, 1 - (embedding <=> CAST(:query AS vector)) AS similarity
    FROM ml.image_embeddings
    WHERE product_id IS NOT NULL AND product_id IS DISTINCT FROM CAST(:exclude AS text)
    ORDER BY embedding <=> CAST(:query AS vector)
    LIMIT :k
""")


async def nearest_products(
    session: AsyncSession, query: list[float], k: int, exclude: str | None = None
) -> list[dict[str, Any]]:
    params = {"query": to_literal(query), "k": k, "exclude": exclude}
    return [dict(row) for row in (await session.execute(NEAREST_SQL, params)).mappings()]


# product_embedding => embedding indexado de un producto (o None si su imagen aún no se clasificó)
async def product_embedding(session: AsyncSession, product_id: str) -> list[float] | None:
    sql = text("SELECT embedding FROM ml.image_embeddings WHERE product_id = :pid")
    value = (await session.execute(sql, {"pid": product_id})).scalar_one_or_none()
    return None if value is None else from_literal(value)
