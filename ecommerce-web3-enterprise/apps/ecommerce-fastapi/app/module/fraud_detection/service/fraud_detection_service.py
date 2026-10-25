# fraud_detection_service.py (scikit-learn + XGBoost) => casos de uso: analizar una transacción,
# listar/consultar alertas y registrar la revisión humana.
# Patrón: Service Layer + Strategy (señales opcionales) + Cache con TTL (los modelos se reentrenan
# como máximo una vez por hora y por proceso, no en cada transacción). Paradigma: POO + asíncrono.

import asyncio
import time
from typing import Any

from app.module.fraud_detection.exception.fraud_detection_exception import (
    AlertAlreadyReviewedError,
    AlertNotFoundError,
)
from app.module.fraud_detection.ml import fraud_classifier, isolation_forest
from app.module.fraud_detection.ml.risk_scorer import combine, risk_level, rule_score
from app.module.fraud_detection.model.fraud_detection_model import (
    AlertDismissal,
    FraudAlert,
    FraudAnalysis,
)
from app.module.fraud_detection.repository.fraud_detection_repository import (
    FraudDetectionRepository,
)
from app.shared.middleware.auth_middleware import AuthUser
from app.shared.util.pagination_util import PageParams

MODEL_TTL_SECONDS = 3600
_models: dict[str, Any] = {}  # {"built_at", "forest", "classifier"} — caché por proceso


class FraudDetectionService:
    def __init__(self, repository: FraudDetectionRepository) -> None:
        self.repository = repository

    async def _load_models(self) -> tuple[Any, Any]:
        if not _models or time.monotonic() - _models["built_at"] > MODEL_TTL_SECONDS:
            history, labeled = await self.repository.history(), await self.repository.labeled()
            forest = await asyncio.to_thread(isolation_forest.fit, history)
            classifier = await asyncio.to_thread(fraud_classifier.fit, labeled)
            _models.update(built_at=time.monotonic(), forest=forest, classifier=classifier)
        return _models["forest"], _models["classifier"]

    async def analyze(
        self, user_id: str, order_id: str | None, features: dict[str, Any]
    ) -> FraudAnalysis:
        # bool -> int en TODAS las señales booleanas (los modelos y el JSON guardado usan 0/1)
        features = {
            key: int(value) if isinstance(value, bool) else value for key, value in features.items()
        }
        rules, triggered = rule_score(features)
        forest, classifier = await self._load_models()
        anomaly = isolation_forest.anomaly_score(forest, features) if forest else None
        probability, shap = (
            fraud_classifier.predict(classifier, features) if classifier else (None, {})
        )
        score = combine(rules, anomaly, probability)
        analysis = FraudAnalysis(
            order_id=order_id,
            user_id=user_id,
            features=features,
            rule_score=rules,
            anomaly_score=anomaly,
            classifier_score=probability,
            risk_score=score,
            risk_level=risk_level(score),
            explanation={"rules": triggered, "shap": shap},
        )
        await self.repository.save(analysis)
        if analysis.risk_level != "LOW":  # MEDIUM y HIGH generan alerta para revisión humana
            await self.repository.add(
                FraudAlert(analysis_id=analysis.id, risk_level=analysis.risk_level)
            )
        await self.repository.commit()
        await self.repository.refresh(analysis)
        return analysis

    async def list_alerts(self, status: str | None, level: str | None, params: PageParams):
        return await self.repository.list_alerts(status, level, params)

    async def get_alert(self, alert_id: str) -> FraudAlert:
        if (alert := await self.repository.get(alert_id)) is None:
            raise AlertNotFoundError(alert_id)
        return alert

    async def dismiss(
        self, reviewer: AuthUser, alert_id: str, reason: str, notes: str
    ) -> FraudAlert:
        alert = await self.get_alert(alert_id)
        if alert.dismissal is not None:
            raise AlertAlreadyReviewedError()
        await self.repository.save(
            AlertDismissal(alert_id=alert.id, reason=reason, reviewed_by=reviewer.id, notes=notes)
        )
        alert.status = "DISMISSED"
        await self.repository.commit()
        await self.repository.refresh(alert, ["dismissal"])  # Recarga la relación recién creada
        _models.clear()  # Nueva etiqueta: el clasificador se reentrena en el próximo análisis
        return alert
