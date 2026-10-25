# fraud_classifier.py (XGBoost) => clasificador binario fraude / legítimo entrenado con las
# revisiones humanas de alertas (AlertDismissal: CONFIRMED_FRAUD = 1, FALSE_POSITIVE = 0).
# Solo se activa cuando hay etiquetas suficientes de AMBAS clases; antes, el riesgo usa reglas y
# anomalía. Explicación con TreeSHAP nativo de XGBoost (sin la librería "shap").
# Patrón: Strategy. Paradigma: funcional.

import pandas as pd
from xgboost import DMatrix, XGBClassifier

from app.module.fraud_detection.ml.risk_scorer import FEATURES
from app.shared.constants.ml_constants import RANDOM_STATE

MIN_LABELS_PER_CLASS = 10


def fit(labeled: pd.DataFrame) -> XGBClassifier | None:
    counts = labeled["label"].value_counts() if not labeled.empty else pd.Series(dtype=int)
    if len(counts) < 2 or counts.min() < MIN_LABELS_PER_CLASS:
        return None
    params = {
        "n_estimators": 150,
        "max_depth": 4,
        "learning_rate": 0.1,
        "n_jobs": 2,
        "random_state": RANDOM_STATE,
    }
    return XGBClassifier(**params).fit(labeled[FEATURES], labeled["label"])


# predict => (probabilidad de fraude, contribuciones SHAP por feature ordenadas por impacto)
def predict(model: XGBClassifier, features: dict) -> tuple[float, dict[str, float]]:
    row = pd.DataFrame([features])[FEATURES]
    probability = float(model.predict_proba(row)[0, 1])
    values = model.get_booster().predict(DMatrix(row), pred_contribs=True)[0][:-1]
    ranked = sorted(zip(FEATURES, values, strict=True), key=lambda pair: -abs(pair[1]))
    return round(probability, 4), {name: round(float(value), 4) for name, value in ranked}
