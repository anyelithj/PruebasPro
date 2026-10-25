# personalization_repository.py (SQLAlchemy async) => interacciones (propias + compras de Express),
# versiones del modelo y perfiles. Patrón: Repository (hereda SqlRepository). Paradigma: asíncrono.

import pandas as pd
from sqlalchemy import func, select, text

from app.config.database_config import SqlRepository
from app.module.personalization.model.personalization_model import (
    InteractionRecord,
    PersonalizationModel,
    PersonalizationProfile,
)
from app.shared.types.ml_types import JobStatus

# Señales unificadas: interacciones registradas por la API + compras reales (peso de PURCHASE)
SIGNALS_SQL = text("""
    SELECT user_id, product_id, weight, created_at FROM ml.interaction_records
    WHERE CAST(:user_id AS text) IS NULL OR user_id = CAST(:user_id AS text)
    UNION ALL
    SELECT o."userId", oi."productId", 5.0, o."placedAt"
    FROM public.order_items oi JOIN public.orders o ON o.id = oi."orderId"
    WHERE o.status <> 'CANCELLED' AND oi."productId" IS NOT NULL
      AND (CAST(:user_id AS text) IS NULL OR o."userId" = CAST(:user_id AS text))
""")


class PersonalizationRepository(SqlRepository[InteractionRecord]):
    entity = InteractionRecord

    async def signals(self, user_id: str | None = None) -> pd.DataFrame:
        rows = (await self.session.execute(SIGNALS_SQL, {"user_id": user_id})).all()
        return pd.DataFrame(rows, columns=["user_id", "product_id", "weight", "created_at"])

    async def next_version(self) -> int:
        return (
            int(
                (
                    await self.session.execute(
                        select(func.coalesce(func.max(PersonalizationModel.version), 0))
                    )
                ).scalar_one()
            )
            + 1
        )

    async def latest_model(self) -> PersonalizationModel | None:
        query = (
            select(PersonalizationModel)
            .where(PersonalizationModel.status == JobStatus.DONE)
            .order_by(PersonalizationModel.version.desc())
            .limit(1)
        )
        return (await self.session.execute(query)).scalar_one_or_none()

    async def model(self, model_id: str) -> PersonalizationModel | None:
        return await self.session.get(PersonalizationModel, model_id)

    async def profile(self, user_id: str) -> PersonalizationProfile | None:
        return await self.session.get(PersonalizationProfile, user_id)

    async def save(self, instance: PersonalizationModel | PersonalizationProfile) -> None:
        self.session.add(instance)
        await self.session.flush()
