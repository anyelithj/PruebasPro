# worker.py (Celery) => proceso consumidor de tareas ML largas: entrenamientos, recálculo de
# segmentos de clientes, backtest del pronóstico de demanda, optimización de precios por lotes,
# indexación del conocimiento RAG y evaluaciones del asistente LLM.
# Arranque local:  poetry run celery -A app.worker worker --loglevel=info --pool=solo
# ("--pool=solo": Windows no soporta fork; además procesa una tarea a la vez => consumo estable).
# Patrón: Consumer (Producer/Consumer con la API) + Template Method (_run: misma envoltura para
# todas las tareas, DRY) + Unit of Work (una sesión por tarea).
# Paradigma: asíncrono (corrutinas de los services ejecutadas con asyncio.run dentro de la tarea
# síncrona de Celery).

import asyncio
from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.celery_config import celery_app
from app.config.database_config import SessionFactory, engine
from app.module.customer_analytics.repository.customer_analytics_repository import (
    CustomerAnalyticsRepository,
)
from app.module.customer_analytics.service.customer_analytics_service import (
    RECALCULATE_TASK,
    CustomerAnalyticsService,
)
from app.module.demand_forecasting.repository.forecasting_repository import ForecastingRepository
from app.module.demand_forecasting.service.forecasting_service import (
    TRAIN_TASK as FORECAST_TASK,
)
from app.module.demand_forecasting.service.forecasting_service import ForecastingService
from app.module.llm_assistant.ml.knowledge_indexer import index_knowledge
from app.module.llm_assistant.service.llm_service import (
    EVALUATE_TASK,
    INDEX_TASK,
    build_llm_service,
)
from app.module.ml_prediction.repository.ml_prediction_repository import MLPredictionRepository
from app.module.ml_prediction.service.ml_prediction_service import TRAIN_TASK, MLPredictionService
from app.module.personalization.repository.personalization_repository import (
    PersonalizationRepository,
)
from app.module.personalization.service.personalization_service import (
    TRAIN_TASK as PERSONALIZATION_TASK,
)
from app.module.personalization.service.personalization_service import PersonalizationService
from app.module.price_optimization.repository.pricing_repository import PricingRepository
from app.module.price_optimization.service.pricing_service import BATCH_TASK, PricingService


# _run => abre una sesión, ejecuta el caso de uso y libera el pool: cada tarea usa su propio event
# loop (asyncio.run) y las conexiones no pueden reutilizarse en otro loop
def _run(job: Callable[[AsyncSession], Awaitable[object]]) -> None:
    async def main() -> None:
        async with SessionFactory() as session:
            await job(session)
        await engine.dispose()

    asyncio.run(main())


# "@celery_app.task(name=...)" => registra la función como tarea; el nombre lo usa send_task
@celery_app.task(name=TRAIN_TASK)
def train_model_version(version_id: str) -> None:
    _run(lambda s: MLPredictionService(MLPredictionRepository(s)).run_training(version_id))


# Backtest Prophet + ARIMA => nueva versión del modelo de pronóstico (pesos e intervalo)
@celery_app.task(name=FORECAST_TASK)
def train_forecast_model(model_id: str) -> None:
    _run(
        lambda s: ForecastingService(
            ForecastingRepository(s), MLPredictionService(MLPredictionRepository(s))
        ).run_training(model_id)
    )


@celery_app.task(name=RECALCULATE_TASK)
def recalculate_customers(job_id: str) -> None:
    _run(
        lambda s: CustomerAnalyticsService(CustomerAnalyticsRepository(s)).run_recalculation(job_id)
    )


@celery_app.task(name=PERSONALIZATION_TASK)
def train_personalization(model_id: str) -> None:
    _run(lambda s: PersonalizationService(PersonalizationRepository(s)).run_training(model_id))


@celery_app.task(name=BATCH_TASK)
def batch_optimize(job_id: str) -> None:
    _run(lambda s: PricingService(PricingRepository(s)).run_batch(job_id))


# Embeddings del catálogo/FAQ/políticas (incremental: solo fragmentos nuevos o editados)
@celery_app.task(name=INDEX_TASK)
def index_llm_knowledge(sources: list[str], product_ids: list[str] | None) -> None:
    _run(lambda s: index_knowledge(s, sources, product_ids))


@celery_app.task(name=EVALUATE_TASK)
def evaluate_llm(run_id: str) -> None:
    _run(lambda s: build_llm_service(s).run_evaluation(run_id))
