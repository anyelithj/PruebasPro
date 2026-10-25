# forecasting_service.py (Prophet + ARIMA + Celery) => casos de uso: pronosticar un producto,
# consultar, borrar y crear (entrenar) versiones del modelo de pronóstico.
# Patrón: Service Layer + Strategy (ensamble Prophet/ARIMA) + Producer (encola el backtest en
# Celery) + máquina de estados (QUEUED -> TRAINING -> READY | FAILED).
# Paradigma: POO (repositorios inyectados: DIP) + asíncrono + Data-Driven (DataFrames al ML).

import asyncio  # to_thread => el ajuste de Prophet/ARIMA (CPU) no bloquea el event loop
from datetime import UTC, date, datetime, timedelta

from app.config.celery_config import celery_app
from app.module.demand_forecasting.exception.forecasting_exception import (
    ForecastFailedError,
    ForecastModelNotFoundError,
    ForecastNotFoundError,
)
from app.module.demand_forecasting.ml import promotion_simulator
from app.module.demand_forecasting.ml.ensemble_forecaster import backtest, forecast
from app.module.demand_forecasting.ml.seasonality_detector import detect
from app.module.demand_forecasting.model.forecasting_model import ForecastModel, ForecastResult
from app.module.demand_forecasting.repository.forecasting_repository import ForecastingRepository
from app.module.ml_prediction.ml.feature_engineer import complete_daily_series
from app.module.ml_prediction.model.ml_prediction_model import ModelStatus
from app.module.ml_prediction.service.ml_prediction_service import MLPredictionService
from app.module.price_optimization.exception.pricing_exception import ProductNotPriceableError
from app.module.price_optimization.ml import elasticity_calculator
from app.module.price_optimization.repository.pricing_repository import PricingRepository
from app.shared.constants.ml_constants import (
    FORECAST_BACKTEST_DAYS,
    FORECAST_HOLDOUT_DAYS,
    MAX_PROPHET_VALIDATION_PRODUCTS,
)

TRAIN_TASK = "demand_forecasting.train_forecast_model"  # Nombre que registra worker.py


class ForecastingService:
    # "history" => MLPredictionService reutilizado para la historia diaria y el arranque en frío
    # por similitud CLIP (misma lógica que 5.1: DRY)
    def __init__(self, repository: ForecastingRepository, history: MLPredictionService) -> None:
        self.repository = repository
        self.history = history

    # create_forecast => createForecastResult() de la matriz
    async def create_forecast(
        self, product_id: str, horizon_days: int, granularity: str
    ) -> ForecastResult:
        model = await self.repository.latest_ready_model()
        if model is None:  # Guard clause: sin backtest no hay pesos ni intervalo
            raise ForecastModelNotFoundError()
        history, cold_start = await self.history.product_history(product_id)
        try:
            points = await asyncio.to_thread(
                forecast,
                history,
                horizon_days,
                model.prophet_weight,
                model.metrics["nrmse"],  # Error relativo: se escala al nivel del producto
                granularity,
            )
        except ValueError as error:
            raise ForecastFailedError(str(error)) from error
        result = ForecastResult(
            forecast_model_id=model.id,
            product_id=product_id,
            horizon_days=horizon_days,
            granularity=granularity,
            forecast=points,
            seasonality=detect(history),  # O(n) con NumPy: barato, no requiere hilo
            cold_start=cold_start,
        )
        await self.repository.add(result)
        await self.repository.commit()
        await self.repository.refresh(result)
        return result

    # simulate => RF-24.14 impacto de un descuento y/o evento especial en la demanda del producto.
    # Reutiliza la historia diaria (5.1) y la elasticidad de precios (5.5): DRY entre módulos
    async def simulate(
        self,
        product_id: str,
        discount: float,
        event: str,
        start: date | None,
        promo_days: int,
        horizon_days: int,
    ) -> dict:
        pricing = PricingRepository(self.repository.session)
        if (product := await pricing.product(product_id)) is None:
            raise ProductNotPriceableError(product_id)
        history, _ = await self.history.product_history(product_id)
        sales = await pricing.sales()
        elasticity, _ = elasticity_calculator.estimate(sales[sales["product_id"] == product_id])
        today = datetime.now(UTC).date()
        window = promotion_simulator.event_window(event, today.year)
        begin = start or (window[0] if window and window[0] >= today else today + timedelta(days=1))
        result = promotion_simulator.simulate(
            history,
            product.price_cents,
            discount,
            elasticity,
            event,
            begin,
            promo_days,
            horizon_days,
        )
        return {
            "product_id": product_id,
            "price_cents": product.price_cents,
            "elasticity": elasticity,
            **result.__dict__,
        }

    async def get(self, forecast_id: str) -> ForecastResult:
        if (result := await self.repository.get(forecast_id)) is None:  # ":=" => asigna y evalúa
            raise ForecastNotFoundError(forecast_id)
        return result

    async def delete(self, forecast_id: str) -> None:
        await self.repository.delete(await self.get(forecast_id))  # Reutiliza el 404 (DRY)
        await self.repository.commit()

    # enqueue_model => createForecastModel(): versión N+1 en QUEUED y backtest en Celery (202)
    async def enqueue_model(self) -> tuple[ForecastModel, str]:
        model = ForecastModel(version=await self.repository.next_version_number())
        await self.repository.add(model)
        await self.repository.commit()
        job = celery_app.send_task(TRAIN_TASK, args=[model.id])
        return model, job.id

    # run_training => lo ejecuta el worker: backtest de Prophet y ARIMA sobre los productos más
    # vendidos (límite = ahorro de CPU/energía; el resto aporta poco volumen al error)
    async def run_training(self, model_id: str) -> None:
        model = await self.repository.get_model(model_id)
        if model is None:  # La versión pudo borrarse mientras esperaba en la cola
            return
        model.status = ModelStatus.TRAINING
        await self.repository.commit()
        try:
            today = datetime.now(UTC).date()
            sales = await self.repository.daily_sales(
                today - timedelta(days=FORECAST_BACKTEST_DAYS)
            )
            series = complete_daily_series(sales, until=today)
            if series.empty:  # Guard clause: sin pedidos en la ventana no hay nada que validar
                raise ValueError(f"Sin ventas en los últimos {FORECAST_BACKTEST_DAYS} días")
            top = (
                series.groupby("product_id")["units"]
                .sum()
                .nlargest(MAX_PROPHET_VALIDATION_PRODUCTS)
                .index
            )
            result = await asyncio.to_thread(
                backtest, series[series["product_id"].isin(top)], FORECAST_HOLDOUT_DAYS
            )
            model.status, model.prophet_weight = ModelStatus.READY, result.prophet_weight
            model.metrics, model.trained_at = result.metrics, datetime.now(UTC)
        # Cualquier fallo queda registrado en la versión (visible en la API), no se pierde
        except Exception as error:
            model.status, model.error = ModelStatus.FAILED, str(error)
        await self.repository.commit()
