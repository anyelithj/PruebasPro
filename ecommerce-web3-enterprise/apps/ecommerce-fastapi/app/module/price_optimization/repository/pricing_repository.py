# pricing_repository.py (SQLAlchemy async) => precios y ventas (lectura de Express), decisiones y
# trabajos por lotes. Patrón: Repository (hereda SqlRepository). Paradigma: asíncrono + POO.

from typing import Any

import pandas as pd
from sqlalchemy import text

from app.config.database_config import SqlRepository
from app.module.price_optimization.model.pricing_model import BatchOptimizationJob, PricingDecision

PRODUCT_SQL = text("""
    SELECT id, "minPriceCents" AS price_cents FROM public.products
    WHERE id = :product_id AND status = 'ACTIVE' AND "minPriceCents" > 0
""")
# RF-18.10 inventario disponible del producto (suma de variantes activas)
STOCK_SQL = text("""
    SELECT COALESCE(SUM(stock - "reservedStock"), 0)::int FROM public.product_variants
    WHERE "productId" = :product_id AND "isActive" = true
""")
# Ventas diarias con el precio unitario promedio cobrado ese día (base de elasticidad y XGBoost)
SALES_SQL = text("""
    SELECT oi."productId" AS product_id, (o."placedAt")::date AS day,
           AVG(oi."unitPriceCents")::float AS price_cents, SUM(oi.quantity)::float AS units
    FROM public.order_items oi JOIN public.orders o ON o.id = oi."orderId"
    WHERE o.status <> 'CANCELLED' AND oi."productId" IS NOT NULL
      AND o."placedAt" >= now() - interval '365 days'
    GROUP BY 1, 2
""")


class PricingRepository(SqlRepository[PricingDecision]):
    entity = PricingDecision

    async def product(self, product_id: str) -> Any | None:
        return (await self.session.execute(PRODUCT_SQL, {"product_id": product_id})).one_or_none()

    async def stock(self, product_id: str) -> int:
        return int((await self.session.execute(STOCK_SQL, {"product_id": product_id})).scalar_one())

    async def sales(self) -> pd.DataFrame:
        rows = (await self.session.execute(SALES_SQL)).all()
        return pd.DataFrame(rows, columns=["product_id", "day", "price_cents", "units"])

    async def job(self, job_id: str) -> BatchOptimizationJob | None:
        return await self.session.get(BatchOptimizationJob, job_id)

    async def save(self, instance: BatchOptimizationJob) -> None:
        self.session.add(instance)
        await self.session.flush()
