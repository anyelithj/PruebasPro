# xgboost_pricer.py (XGBoost) => modelo de demanda diaria en función del precio relativo, entrenado
# con el historial de TODO el catálogo (aprende patrones que un solo producto no tiene). Estima las
# unidades vendidas en cada precio candidato. Sin historial suficiente devuelve None y el agente usa
# la curva de elasticidad. Patrón: Strategy. Paradigma: funcional + Data-Driven.

import pandas as pd
from xgboost import XGBRegressor

from app.shared.constants.ml_constants import RANDOM_STATE

FEATURES = ["price_ratio", "day_of_week", "product_mean_units"]
MIN_ROWS = 200


# features => "price_ratio" = precio del día / precio mediano del producto (comparable entre
# productos)
def features(sales: pd.DataFrame) -> pd.DataFrame:
    grouped = sales.groupby("product_id")
    return sales.assign(
        price_ratio=sales["price_cents"] / grouped["price_cents"].transform("median"),
        day_of_week=pd.to_datetime(sales["day"]).dt.dayofweek,
        product_mean_units=grouped["units"].transform("mean"),
    )


def fit(sales: pd.DataFrame) -> XGBRegressor | None:
    if len(sales) < MIN_ROWS:
        return None
    frame = features(sales)
    params = {
        "n_estimators": 200,
        "max_depth": 4,
        "learning_rate": 0.05,
        "n_jobs": 2,
        "random_state": RANDOM_STATE,
    }
    return XGBRegressor(**params).fit(frame[FEATURES], frame["units"])


# predict_units => unidades diarias esperadas para cada multiplicador de precio (día promedio)
def predict_units(model: XGBRegressor, mean_units: float, multipliers: list[float]) -> list[float]:
    grid = pd.DataFrame(
        {"price_ratio": multipliers, "day_of_week": 3, "product_mean_units": mean_units}
    )
    return [max(0.0, float(u)) for u in model.predict(grid[FEATURES])]
