# customer_analytics_repository.py (SQLAlchemy async) => pedidos (lectura de Express), segmentos,
# LTV y trabajos de recálculo. Patrón: Repository (hereda SqlRepository). Paradigma: asíncrono +
# POO.

import pandas as pd
from sqlalchemy import delete, select, text

from app.config.database_config import SqlRepository
from app.module.customer_analytics.model.customer_analytics_model import (
    CustomerSegment,
    LTVScore,
    RecalculationJob,
)
from app.shared.types.common_types import PageMeta
from app.shared.util.pagination_util import PageParams, paginate

# Solo lectura de Express; pedidos cancelados no cuentan como compra
ORDERS_SQL = text("""
    SELECT "userId" AS user_id, "placedAt" AS placed_at, "totalCents" AS total_cents
    FROM public.orders WHERE status <> 'CANCELLED'
""")
EXPORT_LIMIT = 50_000  # Tope del CSV: protege memoria del proceso


class CustomerAnalyticsRepository(SqlRepository[RecalculationJob]):
    entity = RecalculationJob

    async def orders(self) -> pd.DataFrame:
        frame = pd.DataFrame(
            (await self.session.execute(ORDERS_SQL)).all(),
            columns=["user_id", "placed_at", "total_cents"],
        )
        return frame.assign(placed_at=pd.to_datetime(frame["placed_at"]))

    def _segments(self, rfm_segment: str | None, cluster: int | None):
        query = select(CustomerSegment).order_by(CustomerSegment.user_id)
        if rfm_segment:
            query = query.where(CustomerSegment.rfm_segment == rfm_segment)
        if cluster is not None:
            query = query.where(CustomerSegment.cluster == cluster)
        return query

    async def list_segments(
        self, rfm_segment: str | None, cluster: int | None, params: PageParams
    ) -> tuple[list[CustomerSegment], PageMeta]:
        return await paginate(self.session, self._segments(rfm_segment, cluster), params)

    async def export_segments(
        self, rfm_segment: str | None, cluster: int | None
    ) -> list[CustomerSegment]:
        return list(
            (
                await self.session.execute(self._segments(rfm_segment, cluster).limit(EXPORT_LIMIT))
            ).scalars()
        )

    async def ltv(self, user_id: str) -> LTVScore | None:
        return await self.session.get(LTVScore, user_id)

    # replace_results => sustituye segmentos y LTV por los del nuevo cálculo (misma transacción)
    async def replace_results(
        self, segments: list[CustomerSegment], scores: list[LTVScore]
    ) -> None:
        await self.clear_results()
        self.session.add_all([*segments, *scores])

    async def clear_results(self) -> int:
        deleted = (await self.session.execute(delete(CustomerSegment))).rowcount
        await self.session.execute(delete(LTVScore))
        return deleted
