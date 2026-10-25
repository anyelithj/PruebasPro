# arima_model.py (statsmodels + NumPy) => pronóstico ARIMA estacional de UN producto (segunda
# estrategia del ensamble, junto a Prophet).
# Patrón: Strategy (misma firma que prophet_forecast: intercambiables en ensemble_forecaster).
# Paradigma: funcional (función pura: misma historia => mismo pronóstico).
# Ahorro de recursos: orden pequeño fijo (1,1,1)×(1,0,0,7) en vez de búsqueda automática de órdenes
# (auto-ARIMA ajusta decenas de modelos por producto: mucha más CPU y energía).

import warnings  # Silencia avisos de convergencia de statsmodels (ruido en el log, no errores)

import numpy as np
import pandas as pd

ORDER = (1, 1, 1)  # (p, d, q): 1 rezago autorregresivo, 1 diferencia (tendencia), 1 media móvil
SEASONAL_ORDER = (1, 0, 0, 7)  # Componente estacional semanal (período 7 días)


# arima_forecast => "history" con columnas day, units (un producto) -> array de "horizon_days"
# valores >= 0
def arima_forecast(history: pd.DataFrame, horizon_days: int) -> np.ndarray:
    # Import diferido (lazy): statsmodels solo se carga en memoria si se pronostica
    from statsmodels.tsa.arima.model import ARIMA

    units = history["units"].astype(float).to_numpy()
    # "with warnings.catch_warnings()" => context manager: el filtro solo aplica dentro del bloque
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fitted = ARIMA(units, order=ORDER, seasonal_order=SEASONAL_ORDER).fit()
    # "clip(..., 0, None)" => la demanda no puede ser negativa
    return np.clip(fitted.forecast(steps=horizon_days), 0, None)
