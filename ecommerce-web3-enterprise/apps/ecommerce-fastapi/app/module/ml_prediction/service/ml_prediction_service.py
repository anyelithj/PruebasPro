# ml_prediction_service.py (XGBoost + Celery) => casos de uso del módulo: predecir, consultar,
# borrar y entrenar versiones.
# Patrón: Service Layer + Strategy (elige el entrenador por "model_name" en TRAINERS) + Producer
# (encola en Celery). Paradigma: POO (repositorio inyectado: DIP) + asíncrono (await al repositorio)
# + Data-Driven (DataFrames al ML).

import asyncio  # to_thread => ejecuta la inferencia (CPU) fuera del event loop
import hashlib  # Hash estable para la asignación A/B (mismo producto => misma variante siempre)
from datetime import UTC, date, datetime

import pandas as pd

from app.config.app_config import get_settings
from app.config.celery_config import celery_app
from app.module.ml_prediction.exception.ml_prediction_exception import (
    ModelNotFoundError,
    PredictionFailedError,
    PredictionNotFoundError,
    UnknownModelError,
)
from app.module.ml_prediction.ml.feature_engineer import complete_daily_series
from app.module.ml_prediction.ml.model_loader import load_model
from app.module.ml_prediction.ml.xgboost_trainer import TRAINERS, DemandTrainer, history_start
from app.module.ml_prediction.model.ml_prediction_model import (
    ModelStatus,
    ModelVersion,
    PredictionResult,
)
from app.module.ml_prediction.repository.ml_prediction_repository import MLPredictionRepository
from app.shared.constants.ml_constants import AB_CHALLENGER_PERCENT, COLD_START_NEIGHBORS

# Nombre de la tarea Celery (worker.py la registra con este nombre)
TRAIN_TASK = "ml_prediction.train_model_version"
TRAINING_SINCE = date(2000, 1, 1)  # El entrenamiento usa todo el historial disponible


# _trainer => Factory: devuelve la estrategia registrada o UnknownModelError (400)
def _trainer(model_name: str) -> DemandTrainer:
    trainer_class = TRAINERS.get(model_name)
    if trainer_class is None:
        raise UnknownModelError(model_name)
    return trainer_class()


# ab_variant => función pura: el mismo producto cae siempre en el mismo grupo (comparación justa
# entre versiones). "% 100" reparte los productos en 100 cubetas uniformes.
def ab_variant(product_id: str) -> str:
    bucket = int(hashlib.sha256(product_id.encode()).hexdigest(), 16) % 100
    return "challenger" if bucket < AB_CHALLENGER_PERCENT else "champion"


class MLPredictionService:
    def __init__(self, repository: MLPredictionRepository) -> None:
        self.repository = repository

    async def generate_prediction(
        self, product_id: str, horizon_days: int, model_name: str
    ) -> PredictionResult:
        trainer = _trainer(model_name)
        versions = await self.repository.ready_versions(model_name)
        if not versions:  # Guard clause: aún no hay un modelo entrenado
            raise ModelNotFoundError(model_name)
        # A/B testing: con 2 versiones READY, la nueva (challenger) atiende al 20 % de los productos
        # y la anterior (champion) al resto; con una sola, todos usan esa
        variant = ab_variant(product_id) if len(versions) == 2 else "champion"
        version = versions[0] if variant == "challenger" or len(versions) == 1 else versions[1]

        history, cold_start = await self.product_history(product_id)
        model = load_model(version.artifact_path)
        try:
            # "asyncio.to_thread" => la inferencia es CPU; en otro hilo no congela otras peticiones
            forecast = await asyncio.to_thread(trainer.forecast, model, history, horizon_days)
            explanation = await asyncio.to_thread(trainer.explain, model, history)
        except ValueError as error:
            raise PredictionFailedError(str(error)) from error

        prediction = PredictionResult(
            model_version_id=version.id,
            product_id=product_id,
            horizon_days=horizon_days,
            forecast=forecast,
            variant=variant,
            explanation=explanation,
            cold_start=cold_start,
        )
        await self.repository.add(prediction)
        await self.repository.commit()
        await self.repository.refresh(prediction)
        return prediction

    # product_history => (serie diaria del producto, ¿arranque en frío?). Sin ventas propias, usa el
    # promedio diario de los productos visualmente más parecidos (feature store CLIP); sin vecinos,
    # ceros. Público: demand_forecasting reutiliza la misma historia y arranque en frío (DRY).
    async def product_history(self, product_id: str) -> tuple[pd.DataFrame, bool]:
        today = datetime.now(UTC).date()
        start = history_start(today)
        history = complete_daily_series(
            await self.repository.daily_sales(since=start, product_ids=[product_id]), until=today
        )
        if not history.empty:
            return history, False
        days = pd.date_range(start, today, freq="D")
        neighbors = await self.repository.similar_products(product_id, COLD_START_NEIGHBORS)
        sales = (
            await self.repository.daily_sales(since=start, product_ids=neighbors)
            if neighbors
            else None
        )
        if sales is None or sales.empty:
            return pd.DataFrame({"product_id": product_id, "day": days, "units": 0.0}), False
        # Suma diaria de los vecinos / nº de vecinos = demanda media de un producto "parecido"
        daily = complete_daily_series(sales, until=today).groupby("day")["units"].sum() / len(
            neighbors
        )
        units = daily.reindex(days, fill_value=0.0).to_numpy()
        return pd.DataFrame({"product_id": product_id, "day": days, "units": units}), True

    async def get_prediction(self, prediction_id: str) -> PredictionResult:
        prediction = await self.repository.get_prediction(prediction_id)
        if prediction is None:
            raise PredictionNotFoundError(prediction_id)
        return prediction

    async def delete_prediction(self, prediction_id: str) -> None:
        prediction = await self.get_prediction(prediction_id)  # Reutiliza la validación 404 (DRY)
        await self.repository.delete(prediction)
        await self.repository.commit()

    # enqueue_training => crea la versión N+1 en estado QUEUED y encola el entrenamiento (la API
    # responde 202 al instante)
    async def enqueue_training(self, model_name: str) -> tuple[ModelVersion, str]:
        _trainer(model_name)  # Valida el nombre ANTES de crear la versión
        version = ModelVersion(
            model_name=model_name, version=await self.repository.next_version_number(model_name)
        )
        await self.repository.add(version)
        await self.repository.commit()
        # "send_task" por nombre => el service no importa worker.py (sin dependencia circular)
        job = celery_app.send_task(TRAIN_TASK, args=[version.id])
        return version, job.id

    # run_training => lo ejecuta el worker de Celery: QUEUED -> TRAINING -> READY | FAILED (máquina
    # de estados)
    async def run_training(self, version_id: str) -> None:
        version = await self.repository.get_version(version_id)
        if version is None:  # La versión pudo borrarse mientras esperaba en la cola
            return
        version.status = ModelStatus.TRAINING
        await self.repository.commit()
        try:
            today = datetime.now(UTC).date()
            series = complete_daily_series(
                await self.repository.daily_sales(since=TRAINING_SINCE), until=today
            )
            artifact = get_settings().MODEL_DIR / version.model_name / f"v{version.version}.joblib"
            result = await asyncio.to_thread(_trainer(version.model_name).train, series, artifact)
            version.status, version.metrics = ModelStatus.READY, result.metrics
            version.artifact_path, version.mlflow_run_id = (
                result.artifact_path,
                result.mlflow_run_id,
            )
            version.trained_at = datetime.now(UTC)
        # Cualquier fallo queda registrado en la versión (visible en la API), no se pierde
        except Exception as error:
            version.status, version.error = ModelStatus.FAILED, str(error)
        await self.repository.commit()
