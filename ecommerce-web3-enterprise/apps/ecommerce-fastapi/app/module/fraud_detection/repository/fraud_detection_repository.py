# fraud_detection_repository.py (SQLAlchemy async) => análisis, alertas, revisiones y datos de
# entrenamiento. Patrón: Repository (hereda SqlRepository; raíz = FraudAlert). Paradigma: asíncrono.

import pandas as pd
from sqlalchemy import select

from app.config.database_config import SqlRepository
from app.module.fraud_detection.ml.risk_scorer import FEATURES
from app.module.fraud_detection.model.fraud_detection_model import (
    AlertDismissal,
    FraudAlert,
    FraudAnalysis,
)
from app.shared.types.common_types import PageMeta
from app.shared.util.pagination_util import PageParams, paginate

HISTORY_LIMIT = 5000  # Transacciones recientes para "aprender lo normal" (acota RAM y CPU)
LABELS = {"CONFIRMED_FRAUD": 1, "FALSE_POSITIVE": 0}


class FraudDetectionRepository(SqlRepository[FraudAlert]):
    entity = FraudAlert

    async def history(self) -> pd.DataFrame:
        query = (
            select(FraudAnalysis.features)
            .order_by(FraudAnalysis.created_at.desc())
            .limit(HISTORY_LIMIT)
        )
        rows = (await self.session.execute(query)).scalars().all()
        return pd.DataFrame(list(rows), columns=FEATURES)

    # labeled => features + etiqueta de las alertas revisadas por una persona
    async def labeled(self) -> pd.DataFrame:
        query = (
            select(FraudAnalysis.features, AlertDismissal.reason)
            .join(FraudAlert, FraudAlert.analysis_id == FraudAnalysis.id)
            .join(AlertDismissal, AlertDismissal.alert_id == FraudAlert.id)
            .where(AlertDismissal.reason.in_(LABELS))
        )
        rows = (await self.session.execute(query)).all()
        return pd.DataFrame(
            [{**features, "label": LABELS[reason]} for features, reason in rows],
            columns=[*FEATURES, "label"],
        )

    async def save(self, instance: FraudAnalysis | AlertDismissal) -> None:
        self.session.add(instance)
        await self.session.flush()

    async def list_alerts(
        self, status: str | None, level: str | None, params: PageParams
    ) -> tuple[list[FraudAlert], PageMeta]:
        query = select(FraudAlert).order_by(FraudAlert.created_at.desc())
        if status:
            query = query.where(FraudAlert.status == status)
        if level:
            query = query.where(FraudAlert.risk_level == level)
        return await paginate(self.session, query, params)
