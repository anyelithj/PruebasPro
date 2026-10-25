# test_ml_prediction.py (pytest) => pruebas del pipeline ML de demanda con datos sintéticos (sin
# BD).
# Verifica: serie completa con ceros, features sin fuga del futuro, entrenamiento con métricas y
# pronóstico recursivo.

from datetime import date, timedelta

import joblib
import numpy as np
import pandas as pd
import pytest

from app.module.ml_prediction.ml.feature_engineer import (
    FEATURES,
    build_features,
    complete_daily_series,
)
from app.module.ml_prediction.ml.xgboost_trainer import (
    XGBoostDemandTrainer,
    XGBoostProphetEnsembleTrainer,
    next_day_features,
)
from app.module.ml_prediction.service.ml_prediction_service import ab_variant

TODAY = date(2026, 10, 3)


# synthetic_sales => 2 productos, 180 días, patrón semanal (fines de semana venden el doble) + ruido
def synthetic_sales(days: int = 180) -> pd.DataFrame:
    rng = np.random.default_rng(0)
    rows = []
    for product, base in (("p1", 5), ("p2", 2)):
        for offset in range(days):
            day = TODAY - timedelta(days=days - 1 - offset)
            units = base * (2 if day.weekday() >= 5 else 1) + rng.poisson(1)
            # Huecos: días sin ventas que complete_daily_series debe rellenar con 0
            if offset % 10 != 3:
                rows.append({"product_id": product, "day": day, "units": float(units)})
    return pd.DataFrame(rows)


def test_complete_daily_series_fills_missing_days_with_zero() -> None:
    series = complete_daily_series(synthetic_sales(30), until=TODAY)
    assert len(series) == 2 * 30  # Una fila por producto y día
    assert (series["units"] == 0).sum() == 2 * 3  # Los 3 huecos por producto


def test_build_features_uses_only_past_values() -> None:
    series = complete_daily_series(synthetic_sales(60), until=TODAY)
    features = build_features(series)
    p1 = series[series["product_id"] == "p1"].reset_index(drop=True)
    row = features[features["product_id"] == "p1"].iloc[-1]
    # lag_1 del último día = ventas del día anterior (nunca el valor del mismo día)
    assert row["lag_1"] == p1["units"].iloc[-2]
    assert not features[FEATURES].isna().any().any()


def test_train_and_forecast(tmp_path) -> None:
    series = complete_daily_series(synthetic_sales(), until=TODAY)
    trainer = XGBoostDemandTrainer()
    result = trainer.train(series, tmp_path / "v1.joblib")

    assert set(result.metrics) == {"rmse", "mae", "r2"}
    assert result.metrics["r2"] > 0.3  # Aprende el patrón semanal (umbral holgado: datos con ruido)

    model = joblib.load(result.artifact_path)
    history = series[series["product_id"] == "p1"]
    forecast = trainer.forecast(model, history, horizon=14)
    assert len(forecast) == 14
    assert forecast[0]["date"] == (TODAY + timedelta(days=1)).isoformat()
    assert all(point["units"] >= 0 for point in forecast)


@pytest.mark.parametrize("days", [0, 40])  # Sin pedidos (BD recién sembrada) y con historial corto
def test_train_rejects_short_history(tmp_path, days: int) -> None:
    series = complete_daily_series(synthetic_sales(days) if days else pd.DataFrame(), until=TODAY)
    with pytest.raises(ValueError, match="Historial insuficiente"):
        XGBoostDemandTrainer().train(series, tmp_path / "v1.joblib")


def test_explain_shap_values_add_up_to_prediction(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    series = complete_daily_series(synthetic_sales(), until=TODAY)
    trainer = XGBoostDemandTrainer()
    model = joblib.load(trainer.train(series, tmp_path / "v1.joblib").artifact_path)
    history = series[series["product_id"] == "p1"]
    explanation = trainer.explain(model, history)
    raw = float(model.predict(next_day_features(history)[FEATURES])[0])
    # Propiedad de SHAP: valor base + suma de contribuciones = predicción del modelo
    total = explanation["base_value"] + sum(explanation["contributions"].values())
    assert total == pytest.approx(raw, abs=1e-2)
    assert list(explanation["contributions"]) == sorted(
        FEATURES, key=lambda f: -abs(explanation["contributions"][f])
    )


def test_ensemble_blends_xgboost_and_prophet(tmp_path) -> None:
    series = complete_daily_series(synthetic_sales(), until=TODAY)
    trainer = XGBoostProphetEnsembleTrainer()
    result = trainer.train(series, tmp_path / "v1.joblib")
    assert 0 <= result.metrics["xgb_weight"] <= 1
    assert {"rmse_xgb", "rmse_prophet"} <= set(result.metrics)

    model = joblib.load(result.artifact_path)
    forecast = trainer.forecast(model, series[series["product_id"] == "p1"], horizon=7)
    assert len(forecast) == 7 and all(point["units"] >= 0 for point in forecast)
    assert "xgb_weight" in trainer.explain(model, series[series["product_id"] == "p1"])


def test_ab_variant_is_stable_and_splits_about_20_percent() -> None:
    ids = [f"product-{n}" for n in range(2000)]
    share = sum(ab_variant(pid) == "challenger" for pid in ids) / len(ids)
    assert 0.15 < share < 0.25
    assert all(ab_variant(pid) == ab_variant(pid) for pid in ids[:50])  # Determinista
