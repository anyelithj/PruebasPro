# pricing_service.py (NumPy + XGBoost + Celery) => casos de uso: recalcular el precio óptimo de un
# producto, consultar decisiones, limpiar la caché y optimizar por lotes en segundo plano.
# Patrón: Service Layer + Strategy (demanda: XGBoost o elasticidad; objetivo: revenue/clearance/
# competitive) + Cache con TTL (ventas y modelo de demanda reutilizados 1 h: un lote de 500
# productos no relee ni reentrena 500 veces). Paradigma: POO + asíncrono.

import asyncio
import time
from datetime import UTC, datetime
from typing import Any

import pandas as pd

from app.config.celery_config import celery_app
from app.module.price_optimization.exception.pricing_exception import (
    PricingDecisionNotFoundError,
    ProductNotPriceableError,
)
from app.module.price_optimization.ml import (
    competitor_analyzer,
    elasticity_calculator,
    markdown_optimizer,
    rl_price_agent,
    xgboost_pricer,
)
from app.module.price_optimization.model.pricing_model import BatchOptimizationJob, PricingDecision
from app.module.price_optimization.repository.pricing_repository import PricingRepository
from app.shared.types.ml_types import JobStatus

BATCH_TASK = "price_optimization.batch_optimize"
CACHE_TTL_SECONDS = 3600
DEFAULT_MARGIN = 0.4  # RF-18.10 sin costo registrado se asume 40 % de margen bruto
_cache: dict[str, Any] = {}  # {"built_at", "sales", "model"} por proceso


def _demand(
    product_sales: pd.DataFrame, model: Any, elasticity: float
) -> tuple[list[float], str, float]:
    recent = product_sales.sort_values("day").tail(30)
    # 1.0 => escala relativa
    mean_units = float(recent["units"].mean()) if not recent.empty else 1.0
    if model is not None and not recent.empty:
        return (
            xgboost_pricer.predict_units(model, mean_units, rl_price_agent.ARMS),
            "xgboost",
            mean_units,
        )
    units = [
        elasticity_calculator.expected_units(mean_units, 1.0, m, elasticity)
        for m in rl_price_agent.ARMS
    ]
    return units, "elasticity", mean_units


class PricingService:
    def __init__(self, repository: PricingRepository) -> None:
        self.repository = repository

    async def _sales_and_model(self) -> tuple[pd.DataFrame, Any]:
        if not _cache or time.monotonic() - _cache["built_at"] > CACHE_TTL_SECONDS:
            sales = await self.repository.sales()
            _cache.update(
                built_at=time.monotonic(),
                sales=sales,
                model=await asyncio.to_thread(xgboost_pricer.fit, sales),
            )
        return _cache["sales"], _cache["model"]

    async def recalculate(
        self,
        product_id: str,
        strategy: str,
        competitor_prices: list[int],
        job_id: str | None = None,
    ) -> PricingDecision:
        if (product := await self.repository.product(product_id)) is None:
            raise ProductNotPriceableError(product_id)
        sales, model = await self._sales_and_model()
        product_sales = sales[sales["product_id"] == product_id]
        elasticity, method = elasticity_calculator.estimate(product_sales)
        units, demand_model, _ = _demand(product_sales, model, elasticity)
        # Incertidumbre: alta sin historial (explora), baja con muchos días de ventas (explota)
        uncertainty = 0.3 if product_sales.empty else max(0.05, 1 / len(product_sales) ** 0.5)
        market = competitor_analyzer.analyze(product.price_cents, competitor_prices)
        ceiling = competitor_analyzer.ceiling(market) if strategy == "competitive" else None
        decision = rl_price_agent.choose(product.price_cents, units, uncertainty, strategy, ceiling)
        row = await self.repository.add(
            PricingDecision(
                product_id=product_id,
                current_price_cents=product.price_cents,
                recommended_price_cents=round(product.price_cents * decision.multiplier),
                multiplier=decision.multiplier,
                expected_units=decision.expected_units,
                expected_revenue_cents=int(decision.expected_revenue_cents),
                elasticity=elasticity,
                elasticity_method=method,
                demand_model=demand_model,
                strategy=strategy,
                explanation={
                    "arms": decision.arms,
                    "market": market,
                    "uncertainty": round(uncertainty, 4),
                },
                job_id=job_id,
            )
        )
        await self.repository.commit()
        await self.repository.refresh(row)
        return row

    # markdown => RF-18.10 calendario de rebajas para liquidar el inventario en "weeks" semanas.
    # Demanda semanal = 7 x promedio diario reciente, escalada con la elasticidad del producto
    async def markdown(
        self,
        product_id: str,
        weeks: int,
        revenue_weight: float,
        unit_cost_cents: int | None,
        salvage_rate: float,
        stock: int | None,
    ) -> dict[str, Any]:
        if (product := await self.repository.product(product_id)) is None:
            raise ProductNotPriceableError(product_id)
        sales, _ = await self._sales_and_model()
        product_sales = sales[sales["product_id"] == product_id]
        elasticity, _ = elasticity_calculator.estimate(product_sales)
        recent = product_sales.sort_values("day").tail(30)
        weekly = float(recent["units"].sum()) / 30 * 7 if not recent.empty else 1.0
        units_on_hand = stock if stock is not None else await self.repository.stock(product_id)
        cost = unit_cost_cents or round(product.price_cents * (1 - DEFAULT_MARGIN))
        plan = markdown_optimizer.optimize(
            product.price_cents,
            units_on_hand,
            weeks,
            lambda m: elasticity_calculator.expected_units(weekly, 1.0, m, elasticity),
            cost,
            revenue_weight,
            salvage_rate,
        )
        return {
            "product_id": product_id,
            "price_cents": product.price_cents,
            "stock": units_on_hand,
            "unit_cost_cents": cost,
            "elasticity": elasticity,
            "weekly_units": round(weekly, 2),
            "schedule": plan.schedule,
            "weekly_prices_cents": [round(product.price_cents * (1 - d)) for d in plan.schedule],
            "units": plan.units,
            "revenue_cents": plan.revenue_cents,
            "profit_cents": plan.profit_cents,
            "leftover_units": plan.leftover_units,
            "sell_through": plan.sell_through,
            "revenue_weight": revenue_weight,
            "alternatives": plan.alternatives,
        }

    async def get(self, decision_id: str) -> PricingDecision:
        if (decision := await self.repository.get(decision_id)) is None:
            raise PricingDecisionNotFoundError(decision_id)
        return decision

    async def clear_cache(self) -> int:
        deleted = await self.repository.delete_all()
        await self.repository.commit()
        _cache.clear()
        return deleted

    async def enqueue_batch(self, product_ids: list[str], strategy: str) -> BatchOptimizationJob:
        # Sin duplicados
        job = BatchOptimizationJob(strategy=strategy, product_ids=list(dict.fromkeys(product_ids)))
        await self.repository.save(job)
        await self.repository.commit()
        celery_app.send_task(BATCH_TASK, args=[job.id])
        return job

    async def run_batch(self, job_id: str) -> None:
        if (job := await self.repository.job(job_id)) is None:
            return
        job.status = JobStatus.RUNNING
        await self.repository.commit()
        failed: list[str] = []
        for product_id in job.product_ids:
            try:
                await self.recalculate(product_id, job.strategy, [], job_id=job.id)
            except ProductNotPriceableError:
                failed.append(product_id)
        job.processed, job.failed = len(job.product_ids) - len(failed), failed
        job.status, job.finished_at = JobStatus.DONE, datetime.now(UTC)
        await self.repository.commit()
