# ml_prediction_repository.py (SQLAlchemy async) => acceso a datos del módulo: versiones,
# predicciones y ventas históricas.
# Patrón: Repository (el service no conoce SQL) + Unit of Work (AsyncSession; el service decide
# cuándo hacer commit). Paradigma: asíncrono (await en cada consulta) + POO (clase con la sesión
# inyectada: DIP).

from datetime import date

import pandas as pd

# select => consultas ORM; text => SQL literal parametrizado
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.ml_prediction.model.ml_prediction_model import (
    ModelStatus,
    ModelVersion,
    PredictionResult,
)
from app.shared.util.feature_store import nearest_products, product_embedding

# Ventas diarias desde las tablas de Express (esquema public, columnas camelCase de Prisma => entre
# comillas). Solo lectura: FastAPI nunca escribe en tablas de Express. Los pedidos cancelados no son
# demanda real. ":product_ids IS NULL OR ..." => un mismo SQL sirve para todo el catálogo
# (entrenamiento) o para una lista de productos (predicción y arranque en frío). "= ANY(array)" =>
# un solo viaje a la BD.
DAILY_SALES_SQL = text("""
    SELECT oi."productId" AS product_id, (o."placedAt")::date AS day,
           SUM(oi.quantity)::float AS units
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi."orderId"
    WHERE o.status <> 'CANCELLED' AND oi."productId" IS NOT NULL
      AND (CAST(:product_ids AS text[]) IS NULL
           OR oi."productId" = ANY(CAST(:product_ids AS text[])))
      AND (o."placedAt")::date >= :since
    GROUP BY 1, 2
""")


class MLPredictionRepository:
    # "__init__" => la sesión llega desde fuera (inyección de dependencias): testeable con una
    # sesión de prueba
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def daily_sales(self, since: date, product_ids: list[str] | None = None) -> pd.DataFrame:
        # Parámetros enlazados (":since") => sin concatenar strings: inmune a inyección SQL
        result = await self.session.execute(
            DAILY_SALES_SQL, {"since": since, "product_ids": product_ids}
        )
        return pd.DataFrame(result.mappings().all(), columns=["product_id", "day", "units"])

    async def next_version_number(self, model_name: str) -> int:
        # "coalesce(max(version), 0) + 1" => 1 para el primer entrenamiento del modelo
        result = await self.session.execute(
            select(func.coalesce(func.max(ModelVersion.version), 0)).where(
                ModelVersion.model_name == model_name
            )
        )
        return int(result.scalar_one()) + 1

    # ready_versions => las 2 versiones READY más recientes: [challenger (nueva), champion
    # (anterior)]
    async def ready_versions(self, model_name: str) -> list[ModelVersion]:
        query = (
            select(ModelVersion)
            .where(ModelVersion.model_name == model_name, ModelVersion.status == ModelStatus.READY)
            .order_by(ModelVersion.version.desc())
            .limit(2)
        )
        return list((await self.session.execute(query)).scalars())

    # similar_products => IDs de productos visualmente parecidos (feature store CLIP en pgvector)
    async def similar_products(self, product_id: str, k: int) -> list[str]:
        embedding = await product_embedding(self.session, product_id)
        if embedding is None:  # El producto aún no tiene imagen indexada
            return []
        rows = await nearest_products(self.session, embedding, k, exclude=product_id)
        return [row["product_id"] for row in rows]

    async def get_version(self, version_id: str) -> ModelVersion | None:
        # Búsqueda por clave primaria (usa el identity map)
        return await self.session.get(ModelVersion, version_id)

    async def get_prediction(self, prediction_id: str) -> PredictionResult | None:
        return await self.session.get(PredictionResult, prediction_id)

    # add => registra la entidad en la Unit of Work; "flush" envía el INSERT y rellena los valores
    # por defecto del servidor
    async def add(self, entity: ModelVersion | PredictionResult) -> None:
        self.session.add(entity)
        await self.session.flush()

    async def delete(self, entity: PredictionResult) -> None:
        await self.session.delete(entity)

    async def commit(self) -> None:
        await self.session.commit()

    async def refresh(self, entity: ModelVersion | PredictionResult) -> None:
        await self.session.refresh(entity)  # Relee columnas asignadas por la BD (created_at)
