# isolation_forest.py (scikit-learn) => detección de anomalías SIN etiquetas: aprende cómo son las
# transacciones normales (historial de análisis) y puntúa qué tan "rara" es una nueva.
# Patrón: Strategy (detector intercambiable). Paradigma: funcional.
# Ahorro: 100 árboles sobre como máximo 5.000 transacciones recientes; un solo hilo.

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.module.fraud_detection.ml.risk_scorer import FEATURES
from app.shared.constants.ml_constants import RANDOM_STATE

MIN_HISTORY = 50  # Con menos transacciones no hay una "normalidad" confiable


def fit(history: pd.DataFrame) -> IsolationForest | None:
    if len(history) < MIN_HISTORY:
        return None
    return IsolationForest(n_estimators=100, random_state=RANDOM_STATE, n_jobs=1).fit(
        history[FEATURES]
    )


# anomaly_score => 0 (normal) a 1 (muy anómala). decision_function < 0 => anómala; la sigmoide
# convierte esa distancia en una probabilidad suave
def anomaly_score(model: IsolationForest, features: dict) -> float:
    decision = float(model.decision_function(pd.DataFrame([features])[FEATURES])[0])
    return round(float(1 / (1 + np.exp(12 * decision))), 4)
