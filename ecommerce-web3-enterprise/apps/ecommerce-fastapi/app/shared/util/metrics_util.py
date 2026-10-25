# metrics_util.py (scikit-learn + NumPy) => métricas de regresión compartidas por los módulos ML
# (RMSE, MAE, R²). Patrón: Utility (funciones puras reutilizables, DRY entre ml_prediction,
# demand_forecasting y price_optimization).
# Paradigma: funcional (sin estado ni efectos secundarios).

from collections.abc import Sequence  # Tipo genérico de secuencia (lista, array...)

import numpy as np  # NumPy: álgebra vectorizada

# Métricas estándar de scikit-learn
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# regression_metrics => {"rmse", "mae", "r2"} redondeados a 4 decimales (legibles en la API y en
# MLflow)
def regression_metrics(y_true: Sequence[float], y_pred: Sequence[float]) -> dict[str, float]:
    return {
        # Raíz del error cuadrático medio
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        # Error absoluto medio (unidades vendidas)
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),  # Varianza explicada (1 = perfecto)
    }


# mape => error porcentual absoluto medio (%), solo sobre días con ventas reales > 0 (con 0 la
# división no está definida). Sin días con ventas => 0.0
def mape(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    actual, predicted = np.asarray(y_true, dtype=float), np.asarray(y_pred, dtype=float)
    mask = actual > 0  # Máscara booleana de NumPy: filtra sin bucles
    if not mask.any():
        return 0.0
    return round(float(np.mean(np.abs(actual[mask] - predicted[mask]) / actual[mask]) * 100), 4)


# inverse_error_weight => peso del modelo A en un ensamble de 2 por error inverso: el que menos se
# equivocó pesa más. w = (1/e_a) / (1/e_a + 1/e_b) = e_b / (e_a + e_b); 0.5 si ambos son 0.
# Lo usan ml_prediction (XGBoost + Prophet) y demand_forecasting (Prophet + ARIMA): DRY
def inverse_error_weight(error_a: float, error_b: float) -> float:
    total = error_a + error_b
    return error_b / total if total else 0.5
