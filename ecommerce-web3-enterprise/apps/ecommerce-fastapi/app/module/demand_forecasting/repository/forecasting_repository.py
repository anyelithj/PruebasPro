# forecasting_repository.py (SQLAlchemy async) => acceso a datos de ForecastResult, ForecastModel y
# ventas diarias. Patrón: Repository (hereda SqlRepository: DRY) + Unit of Work (el service hace
# commit). Paradigma: asíncrono + POO (sesión inyectada: DIP).

from datetime import date

import pandas as pd
from sqlalchemy import func, select

from app.config.database_config import SqlRepository
from app.module.demand_forecasting.model.forecasting_model import ForecastModel, ForecastResult
from app.module.ml_prediction.model.ml_prediction_model import ModelStatus

# Mismo SQL de ventas diarias que ml_prediction (una sola definición: DRY)
from app.module.ml_prediction.repository.ml_prediction_repository import DAILY_SALES_SQL


class ForecastingRepository(SqlRepository[ForecastResult]):
    entity = ForecastResult

    async def daily_sales(self, since: date) -> pd.DataFrame:
        result = await self.session.execute(DAILY_SALES_SQL, {"since": since, "product_ids": None})
        return pd.DataFrame(result.mappings().all(), columns=["product_id", "day", "units"])

    async def get_model(self, model_id: str) -> ForecastModel | None:
        return await self.session.get(ForecastModel, model_id)

    # latest_ready_model => la versión READY más reciente (la que atiende los pronósticos)
    async def latest_ready_model(self) -> ForecastModel | None:
        query = (
            select(ForecastModel)
            .where(ForecastModel.status == ModelStatus.READY)
            .order_by(ForecastModel.version.desc())
            .limit(1)
        )
        return (await self.session.execute(query)).scalar_one_or_none()

    async def next_version_number(self) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(ForecastModel.version), 0))
        )
        return int(result.scalar_one()) + 1
