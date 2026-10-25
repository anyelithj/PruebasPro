# ltv_predictor.py (XGBoost + Pandas) => valor de vida del cliente (LTV) proyectado a 90 días.
# Entrenamiento "point-in-time": features RFM calculadas al corte (hoy - 90 días) y objetivo = lo
# que cada cliente gastó en los 90 días siguientes; el modelo aprende esa relación y se aplica al
# RFM de hoy. Con pocos clientes usa una fórmula (ticket promedio × ritmo de compra × 90 días).
# Patrón: Strategy (XGBoost o heurística según datos). Paradigma: funcional + Data-Driven.

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

from app.module.customer_analytics.ml.rfm_analyzer import RFM_COLUMNS, rfm_table
from app.shared.constants.ml_constants import RANDOM_STATE
from app.shared.util.metrics_util import regression_metrics

HORIZON_DAYS = 90
MIN_TRAINING_CUSTOMERS = 30  # Menos clientes => el modelo memorizaría; se usa la heurística


@dataclass(frozen=True)
class LtvResult:
    ltv_cents: pd.Series  # Indexada por user_id
    method: str  # "xgboost" | "heuristic"
    metrics: dict[str, float]


def _heuristic(rfm: pd.DataFrame, tenure_days: pd.Series) -> pd.Series:
    average_ticket = rfm["monetary_cents"] / rfm["frequency"]
    orders_per_day = rfm["frequency"] / tenure_days.clip(lower=30)  # Mínimo 30 días: evita picos
    return (average_ticket * orders_per_day * HORIZON_DAYS).round()


def predict_ltv(orders: pd.DataFrame, as_of: pd.Timestamp) -> LtvResult:
    current = rfm_table(orders, as_of).set_index("user_id")
    if current.empty:
        return LtvResult(pd.Series(dtype=float), "heuristic", {})
    cutoff = as_of - pd.Timedelta(days=HORIZON_DAYS)
    before = rfm_table(orders[orders["placed_at"] <= cutoff], cutoff).set_index("user_id")
    after = orders[orders["placed_at"] > cutoff].groupby("user_id")["total_cents"].sum()
    target = after.reindex(before.index, fill_value=0)

    if len(before) < MIN_TRAINING_CUSTOMERS:
        tenure = (as_of - orders.groupby("user_id")["placed_at"].min()).dt.days.reindex(
            current.index
        )
        return LtvResult(_heuristic(current, tenure), "heuristic", {})

    x_train, x_val, y_train, y_val = train_test_split(
        before[RFM_COLUMNS], target, test_size=0.2, random_state=RANDOM_STATE
    )
    params = {
        "n_estimators": 200,
        "max_depth": 4,
        "learning_rate": 0.05,
        "n_jobs": 2,
        "random_state": RANDOM_STATE,
    }
    model = XGBRegressor(**params).fit(x_train, y_train)
    metrics = regression_metrics(y_val.tolist(), np.clip(model.predict(x_val), 0, None).tolist())
    model.fit(before[RFM_COLUMNS], target)  # Modelo final con todos los clientes del corte
    ltv = pd.Series(
        np.clip(model.predict(current[RFM_COLUMNS]), 0, None).round(), index=current.index
    )
    return LtvResult(ltv, "xgboost", metrics)
