# customer_analytics_service.py (scikit-learn + XGBoost + Celery) => casos de uso: recalcular
# segmentos RFM/K-Means y LTV (en segundo plano), listarlos/exportarlos, consultar LTV y limpiar.
# Patrón: Service Layer + Producer (encola en Celery) + Pipeline (RFM -> K-Means -> LTV).
# Paradigma: POO (DIP) + asíncrono. Ahorro: el cálculo pesado corre una vez por recálculo (no por
# consulta); las lecturas solo leen resultados guardados.

import asyncio
from datetime import UTC, datetime

import pandas as pd

from app.config.celery_config import celery_app
from app.module.customer_analytics.exception.customer_analytics_exception import LtvNotFoundError
from app.module.customer_analytics.ml.kmeans_segmentation import segment
from app.module.customer_analytics.ml.ltv_predictor import HORIZON_DAYS, predict_ltv
from app.module.customer_analytics.ml.rfm_analyzer import rfm_scores, rfm_table
from app.module.customer_analytics.model.customer_analytics_model import (
    CustomerSegment,
    LTVScore,
    RecalculationJob,
)
from app.module.customer_analytics.repository.customer_analytics_repository import (
    CustomerAnalyticsRepository,
)
from app.shared.types.ml_types import JobStatus
from app.shared.util.pagination_util import PageParams

RECALCULATE_TASK = "customer_analytics.recalculate"


# compute => función pura (CPU, se ejecuta en un hilo): pedidos -> (segmentos, LTV, métricas)
def compute(orders: pd.DataFrame, as_of: pd.Timestamp, job_id: str) -> tuple[list, list, dict]:
    rfm = rfm_scores(rfm_table(orders, as_of))
    if rfm.empty:
        return (
            [],
            [],
            {"customers": 0, "k": 0, "silhouette": None, "ltv_method": None, "ltv_metrics": None},
        )
    clusters = segment(rfm)
    ltv = predict_ltv(orders, as_of)
    segments = [
        CustomerSegment(
            user_id=row.user_id,
            recency_days=int(row.recency_days),
            frequency=int(row.frequency),
            monetary_cents=int(row.monetary_cents),
            r_score=int(row.r_score),
            f_score=int(row.f_score),
            m_score=int(row.m_score),
            rfm_segment=row.rfm_segment,
            cluster=int(cluster),
            features=vector.tolist(),
            job_id=job_id,
        )
        # "zip(..., strict=True)" => las tres secuencias están alineadas por cliente
        for row, cluster, vector in zip(
            rfm.itertuples(), clusters.labels, clusters.features, strict=True
        )
    ]
    scores = [
        LTVScore(
            user_id=user_id,
            ltv_cents=int(value),
            horizon_days=HORIZON_DAYS,
            method=ltv.method,
            job_id=job_id,
        )
        for user_id, value in ltv.ltv_cents.items()
    ]
    metrics = {
        "customers": len(segments),
        "k": clusters.k,
        "silhouette": clusters.silhouette,
        "ltv_method": ltv.method,
        "ltv_metrics": ltv.metrics,
    }
    return segments, scores, metrics


class CustomerAnalyticsService:
    def __init__(self, repository: CustomerAnalyticsRepository) -> None:
        self.repository = repository

    async def enqueue_recalculation(self) -> RecalculationJob:
        job = await self.repository.add(RecalculationJob())
        await self.repository.commit()
        celery_app.send_task(RECALCULATE_TASK, args=[job.id])
        return job

    async def run_recalculation(self, job_id: str) -> None:
        if (job := await self.repository.get(job_id)) is None:
            return
        job.status = JobStatus.RUNNING
        await self.repository.commit()
        try:
            as_of = pd.Timestamp(datetime.now(UTC).replace(tzinfo=None))  # "placedAt" es sin zona
            segments, scores, metrics = await asyncio.to_thread(
                compute, await self.repository.orders(), as_of, job_id
            )
            await self.repository.replace_results(segments, scores)
            for field, value in metrics.items():
                setattr(job, field, value)  # "setattr" => asigna un atributo por nombre
            job.status = JobStatus.DONE
        except Exception as error:  # El fallo queda visible en el trabajo
            job.status, job.error = JobStatus.FAILED, str(error)
        job.finished_at = datetime.now(UTC)
        await self.repository.commit()

    async def list_segments(self, rfm_segment: str | None, cluster: int | None, params: PageParams):
        return await self.repository.list_segments(rfm_segment, cluster, params)

    async def export_segments(
        self, rfm_segment: str | None, cluster: int | None
    ) -> list[CustomerSegment]:
        return await self.repository.export_segments(rfm_segment, cluster)

    async def get_ltv(self, user_id: str) -> LTVScore:
        if (score := await self.repository.ltv(user_id)) is None:
            raise LtvNotFoundError(user_id)
        return score

    async def clear_cache(self) -> int:
        deleted = await self.repository.clear_results()
        await self.repository.commit()
        return deleted
