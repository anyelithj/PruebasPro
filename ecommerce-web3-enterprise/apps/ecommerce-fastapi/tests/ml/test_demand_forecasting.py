# test_demand_forecasting.py (pytest) => 5.1: estacionalidad/anomalías, backtest Prophet + ARIMA,
# intervalos y agregación semanal.

import numpy as np
import pandas as pd
import pytest

from app.module.demand_forecasting.ml.ensemble_forecaster import backtest, forecast
from app.module.demand_forecasting.ml.seasonality_detector import detect


# weekly_series => demanda con ciclo semanal (fines de semana altos) y ruido leve, 70 días
def weekly_series(product_id: str = "p1", days: int = 70, spike: bool = False) -> pd.DataFrame:
    rng = np.random.default_rng(7)
    day = pd.date_range("2026-07-01", periods=days, freq="D")
    units = np.where(day.dayofweek >= 5, 20.0, 8.0) + rng.normal(0, 0.5, days)
    if spike:
        units[40] = 120.0  # Pico tipo Black Friday
    return pd.DataFrame({"product_id": product_id, "day": day, "units": units})


def test_detect_weekly_cycle_and_spike() -> None:
    profile = detect(weekly_series(spike=True))
    assert profile["weekly_strength"] > 0.5
    assert profile["peak_weekday"] in (5, 6)
    assert [a["kind"] for a in profile["anomalies"]] == ["spike"]


def test_backtest_weights_and_metrics() -> None:
    series = pd.concat([weekly_series("p1"), weekly_series("p2")])
    result = backtest(series, holdout=14)
    assert 0 <= result.prophet_weight <= 1
    assert result.metrics["mape"] < 25  # La serie es muy regular: ambos modelos la siguen
    assert {"rmse_prophet", "rmse_arima", "nrmse"} <= result.metrics.keys()


def test_backtest_rejects_short_history() -> None:
    with pytest.raises(ValueError):
        backtest(weekly_series(days=20), holdout=14)


def test_forecast_interval_and_weekly_granularity() -> None:
    daily = forecast(weekly_series(), 14, 0.5, nrmse=0.2, granularity="day")
    assert len(daily) == 14
    assert all(p["lower"] <= p["units"] <= p["upper"] and p["lower"] >= 0 for p in daily)
    weekly = forecast(weekly_series(), 14, 0.5, nrmse=0.2, granularity="week")
    assert sum(p["units"] for p in weekly) == pytest.approx(sum(p["units"] for p in daily), 0.01)
    # Varianzas sumadas: el ancho de una semana completa (weekly[1]; la primera es parcial) es √7
    # veces el diario, no 7 veces
    width = lambda p: p["upper"] - p["units"]  # noqa: E731
    assert width(weekly[1]) == pytest.approx(width(daily[0]) * 7**0.5, rel=0.01)


def test_interval_scales_with_product_level() -> None:
    small = forecast(weekly_series(), 7, 0.5, nrmse=0.2, granularity="day")
    big = weekly_series().assign(units=lambda f: f["units"] * 10)
    large = forecast(big, 7, 0.5, nrmse=0.2, granularity="day")
    assert large[0]["upper"] - large[0]["units"] == pytest.approx(
        10 * (small[0]["upper"] - small[0]["units"]), rel=0.01
    )


def test_constant_series_skips_models() -> None:
    zeros = weekly_series().assign(units=0.0)
    assert all(p["units"] == 0 for p in forecast(zeros, 7, 0.5, nrmse=0.0, granularity="day"))
