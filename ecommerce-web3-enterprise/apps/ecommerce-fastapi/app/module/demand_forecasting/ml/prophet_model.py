# prophet_model.py (Prophet + Pandas) => pronóstico de series temporales de UN producto
# (estacionalidad semanal).
# Lo reutilizan ml_prediction (ensamble XGBoost + Prophet, Sprint 5.1) y demand_forecasting (DRY).
# Patrón: Strategy (otra estrategia de pronóstico intercambiable). Paradigma: funcional (función
# pura sobre DataFrames). Ahorro de recursos: "uncertainty_samples=0" omite la simulación de
# intervalos (cientos de muestras
# por
# predicción) y solo se activa la estacionalidad que la serie puede sostener (semanal; sin anual ni
# diaria).

import logging  # Silencia el log verboso de cmdstanpy (menos E/S en cada ajuste)

import numpy as np
import pandas as pd

logging.getLogger("cmdstanpy").setLevel(logging.WARNING)


# prophet_forecast => "history" con columnas day, units (un producto) -> array de "horizon_days"
# valores >= 0
def prophet_forecast(history: pd.DataFrame, horizon_days: int) -> np.ndarray:
    # Import diferido (lazy): Prophet + Stan solo se cargan en memoria si se usa el ensamble
    from prophet import Prophet  # Modelo aditivo de series temporales (Meta, open source)

    # Prophet exige las columnas "ds" (fecha) e "y" (valor)
    frame = pd.DataFrame(
        {"ds": pd.to_datetime(history["day"]), "y": history["units"].astype(float)}
    )
    model = Prophet(
        weekly_seasonality=True,
        yearly_seasonality=False,  # Requiere 2+ años de historia; con menos sobreajusta
        daily_seasonality=False,  # Datos diarios: no hay patrón intradía que modelar
        # Sin intervalos de incertidumbre => ajuste y predicción mucho más baratos
        uncertainty_samples=0,
    )
    model.fit(frame)
    future = model.make_future_dataframe(periods=horizon_days, include_history=False)
    # "clip(min=0)" => la demanda no puede ser negativa
    return np.clip(model.predict(future)["yhat"].to_numpy(), 0, None)
