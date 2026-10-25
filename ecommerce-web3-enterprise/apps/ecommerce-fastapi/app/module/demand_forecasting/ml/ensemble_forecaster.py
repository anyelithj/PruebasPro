# ensemble_forecaster.py (Prophet + ARIMA + Pandas) => backtest de las dos estrategias, peso del
# ensamble por error inverso, intervalos de confianza y agregación por día/semana/mes.
# Patrón: Strategy + Registry/Factory (METHODS: nombre -> función de pronóstico; un modelo nuevo =
# una entrada, sin tocar el service: OCP) + Value Object (BacktestResult).
# Paradigma: funcional (funciones puras) + Data-Driven (DataFrames de entrada y salida).

from collections.abc import Callable
from dataclasses import dataclass  # Resultado inmutable del backtest
from typing import Any

import numpy as np
import pandas as pd

from app.module.demand_forecasting.ml.arima_model import arima_forecast
from app.module.demand_forecasting.ml.prophet_model import prophet_forecast
from app.shared.constants.ml_constants import Z_95
from app.shared.util.metrics_util import inverse_error_weight, mape, regression_metrics

# Registry de estrategias: misma firma (historia, horizonte) -> array de unidades
METHODS: dict[str, Callable[[pd.DataFrame, int], np.ndarray]] = {
    "prophet": prophet_forecast,
    "arima": arima_forecast,
}
# Granularidad de la API -> regla de "resample" de Pandas ("W-SUN": semanas que cierran en domingo;
# "MS": mes calendario)
RESAMPLE = {"week": "W-SUN", "month": "MS"}
MIN_TRAIN_DAYS = 14  # Dos ciclos semanales: menos y ningún modelo ve el patrón semanal
LEVEL_DAYS = 28  # Días recientes que definen el nivel de demanda del producto (escala del error)


# BacktestResult => lo que el service guarda en ForecastModel (pesos + métricas)
@dataclass(frozen=True)
class BacktestResult:
    prophet_weight: float
    # Error relativo del ensamble (RMSE / demanda media): base del intervalo de cada producto
    nrmse: float
    metrics: dict[str, float]


# forecast_with => una estrategia sobre una historia. Serie constante (p. ej. todo 0) => se repite
# el último valor sin ajustar modelos (resultado idéntico y 0 CPU de entrenamiento)
def forecast_with(method: str, history: pd.DataFrame, horizon: int) -> np.ndarray:
    units = history["units"]
    if units.nunique() <= 1:
        return np.full(horizon, float(units.iloc[-1]) if len(units) else 0.0)
    return METHODS[method](history, horizon)


# backtest => por producto: entrena con todo menos los últimos "holdout" días y los pronostica.
# Mide RMSE de cada estrategia y del ensamble ponderado. "series" => product_id, day, units.
def backtest(series: pd.DataFrame, holdout: int) -> BacktestResult:
    actual: list[np.ndarray] = []
    predicted: dict[str, list[np.ndarray]] = {method: [] for method in METHODS}
    for _, group in series.groupby("product_id"):  # "_" => la clave (product_id) no se usa
        group = group.sort_values("day")
        train, test = group.iloc[:-holdout], group.iloc[-holdout:]
        if len(train) < MIN_TRAIN_DAYS:  # Producto demasiado nuevo para validar
            continue
        actual.append(test["units"].to_numpy(dtype=float))
        for method in METHODS:
            predicted[method].append(forecast_with(method, train, holdout))
    if not actual:  # Guard clause: ningún producto con historia suficiente
        raise ValueError(
            f"Historial insuficiente: se requieren {MIN_TRAIN_DAYS + holdout} días por producto"
        )
    # "np.concatenate" => une los arrays de todos los productos en un solo vector
    y = np.concatenate(actual)
    preds = {method: np.concatenate(arrays) for method, arrays in predicted.items()}
    rmse = {method: regression_metrics(y, pred)["rmse"] for method, pred in preds.items()}
    weight = inverse_error_weight(rmse["prophet"], rmse["arima"])  # Peso de Prophet
    blend = weight * preds["prophet"] + (1 - weight) * preds["arima"]
    metrics = regression_metrics(y, blend) | {
        "mape": mape(y, blend),
        "rmse_prophet": rmse["prophet"],
        "rmse_arima": rmse["arima"],
        "prophet_weight": round(weight, 4),
    }
    # nrmse => error por unidad de demanda: se reescala al nivel de cada producto al pronosticar
    # (un producto de 100 u/día y otro de 2 u/día no tienen el mismo error absoluto)
    metrics["nrmse"] = round(metrics["rmse"] / y.mean(), 4) if y.mean() > 0 else 0.0
    return BacktestResult(weight, metrics["nrmse"], metrics)


# forecast => pronóstico del ensamble con intervalo del 95 % y agregado según "granularity".
# Intervalo POR PRODUCTO: σ diario = nrmse · nivel del producto (media de sus últimos LEVEL_DAYS
# días). Al agregar por semana/mes se suman VARIANZAS, no límites: σ_período = √(Σ σ²) (errores
# diarios independientes), así el intervalo semanal no sale artificialmente ancho.
def forecast(
    history: pd.DataFrame, horizon: int, prophet_weight: float, nrmse: float, granularity: str
) -> list[dict[str, Any]]:
    units = prophet_weight * forecast_with("prophet", history, horizon) + (
        1 - prophet_weight
    ) * forecast_with("arima", history, horizon)
    sigma = nrmse * float(history["units"].tail(LEVEL_DAYS).mean())  # Error típico diario
    days = pd.date_range(history["day"].max() + pd.Timedelta(days=1), periods=horizon, freq="D")
    frame = pd.DataFrame(
        {
            "date": days,
            "units": units,
            "variance": sigma**2,  # "**" => potencia; la varianza sí se suma entre días
        }
    )
    if granularity in RESAMPLE:
        frame = frame.resample(RESAMPLE[granularity], on="date").sum().reset_index()
    margin = Z_95 * np.sqrt(frame["variance"])
    frame["lower"] = np.clip(frame["units"] - margin, 0, None)  # El límite inferior no baja de 0
    frame["upper"] = frame["units"] + margin
    return [
        {
            "date": row.date.date().isoformat(),
            "units": round(float(row.units), 2),
            "lower": round(float(row.lower), 2),
            "upper": round(float(row.upper), 2),
        }
        # "itertuples" => filas como tuplas con nombre (más rápido y liviano que iterrows)
        for row in frame.itertuples(index=False)
    ]
