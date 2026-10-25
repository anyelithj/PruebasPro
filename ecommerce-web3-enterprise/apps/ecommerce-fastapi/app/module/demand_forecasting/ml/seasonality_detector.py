# seasonality_detector.py (Pandas + NumPy) => perfil de la serie de UN producto: fuerza del ciclo
# semanal, tendencia, día pico y días atípicos (picos/caídas de demanda para alertas).
# Patrón: Pipeline (serie -> estacionalidad -> tendencia -> anomalías).
# Paradigma: funcional (funciones puras, sin estado). Solo NumPy/Pandas: O(n), sin entrenar modelos.

from typing import Any

import numpy as np
import pandas as pd

from app.shared.constants.ml_constants import ANOMALY_Z

MAD_TO_STD = 1.4826  # Factor que vuelve la MAD comparable a la desviación estándar (normal)


# robust_z => z-score ROBUSTO (mediana y MAD, no media y std: un pico grande no "infla" el umbral
# y se esconde a sí mismo) sobre el residuo semanal: venta - mediana de su día de la semana, así un
# sábado alto habitual no cuenta como atípico. Devuelve (z, mediana por día) para reutilizarla.
def robust_z(history: pd.DataFrame) -> tuple[np.ndarray, pd.Series]:
    units = history["units"].astype(float)
    # "transform('median')" => la mediana de cada día de la semana, alineada fila a fila
    expected = units.groupby(history["day"].dt.dayofweek).transform("median")
    residual = (units - expected).to_numpy()
    # Con muchos días en 0 la MAD vale 0: se usa la desviación estándar como respaldo
    scale = MAD_TO_STD * np.median(np.abs(residual - np.median(residual))) or residual.std()
    # Serie sin variación => ningún atípico (z = 0)
    return (residual / scale if scale else np.zeros(len(residual))), expected


# detect => perfil completo que se guarda con cada pronóstico (ForecastResult.seasonality)
def detect(history: pd.DataFrame) -> dict[str, Any]:
    z, expected = robust_z(history)
    outlier = np.abs(z) > ANOMALY_Z  # Máscara booleana de días atípicos
    # Serie limpia: los atípicos se reemplazan por lo esperado para su día (no distorsionan el
    # ciclo ni la tendencia); "where" de Pandas conserva el valor donde la condición es True
    clean = history["units"].astype(float).where(~outlier, expected)
    # Autocorrelación con 7 días de rezago: ~1 => ciclo semanal fuerte; 0 si la serie es constante
    weekly = clean.autocorr(lag=7) if len(clean) > 7 and clean.std() > 0 else 0.0
    # "np.polyfit(x, y, 1)[0]" => pendiente de la recta de mínimos cuadrados (unidades por día)
    trend = np.polyfit(np.arange(len(clean)), clean, 1)[0] if len(clean) > 1 else 0.0
    by_weekday = clean.groupby(history["day"].dt.dayofweek).mean()  # 0 = lunes
    return {
        "weekly_strength": round(max(0.0, float(np.nan_to_num(weekly))), 4),
        "trend_per_day": round(float(trend), 4),
        "peak_weekday": int(by_weekday.idxmax()) if not by_weekday.empty else None,
        # "np.flatnonzero" => índices de los días atípicos (vectorizado, sin bucle Python)
        "anomalies": [
            {
                "date": history["day"].iloc[i].date().isoformat(),
                "units": float(history["units"].iloc[i]),
                "kind": "spike" if z[i] > 0 else "drop",  # Pico (Black Friday) o caída inesperada
            }
            for i in np.flatnonzero(outlier)
        ],
    }
