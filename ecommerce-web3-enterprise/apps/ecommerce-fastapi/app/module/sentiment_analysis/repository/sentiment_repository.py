# sentiment_repository.py (SQLAlchemy async) => acceso a datos de SentimentResult.
# Patrón: Repository (hereda SqlRepository: DRY). Paradigma: asíncrono + POO.

from datetime import datetime

import pandas as pd
from sqlalchemy import select

from app.config.database_config import SqlRepository
from app.module.sentiment_analysis.model.sentiment_model import SentimentResult


class SentimentRepository(SqlRepository[SentimentResult]):
    entity = SentimentResult

    async def by_hash(self, text_hash: str) -> SentimentResult | None:
        query = select(SentimentResult).where(SentimentResult.text_hash == text_hash)
        return (await self.session.execute(query)).scalar_one_or_none()

    # scores_since => solo las 2 columnas que necesita el agregado (no trae los textos: menos
    # memoria)
    async def scores_since(self, since: datetime, product_id: str | None) -> pd.DataFrame:
        query = select(SentimentResult.label, SentimentResult.score).where(
            SentimentResult.created_at >= since
        )
        if product_id:
            query = query.where(SentimentResult.product_id == product_id)
        return pd.DataFrame((await self.session.execute(query)).all(), columns=["label", "score"])
