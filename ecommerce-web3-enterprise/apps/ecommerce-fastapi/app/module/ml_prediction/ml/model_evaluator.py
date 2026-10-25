# model_evaluator.py (XGBoost + scikit-learn) => mide un modelo entrenado sobre el set de validación
# (RMSE, MAE, R²). Patrón: Strategy-agnóstico (acepta cualquier estimador con ".predict", interfaz
# común de scikit- learn). Paradigma: funcional (función pura: mismo modelo y datos => mismas
# métricas).

# El estimador puede ser XGBRegressor o cualquier modelo compatible con scikit-learn
from typing import Any

import pandas as pd

from app.module.ml_prediction.ml.feature_engineer import FEATURES
from app.shared.util.metrics_util import regression_metrics  # Métricas compartidas (DRY)


def evaluate(model: Any, validation: pd.DataFrame) -> dict[str, float]:
    # "clip(lower=0)" => la demanda no puede ser negativa: se evalúa la predicción tal como la verá
    # la API
    predictions = pd.Series(model.predict(validation[FEATURES])).clip(lower=0)
    return regression_metrics(validation["units"].tolist(), predictions.tolist())
