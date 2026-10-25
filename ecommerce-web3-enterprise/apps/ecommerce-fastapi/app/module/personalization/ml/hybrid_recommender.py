# hybrid_recommender.py (NumPy) => mezcla colaborativo + contenido + popularidad.
# alpha (peso del colaborativo) crece con el historial del usuario: con pocas interacciones manda el
# contenido (más estable); con muchas, el colaborativo (más personal).
# Patrón: Strategy + Factory (blend decide la fuente de cada recomendación). Paradigma: funcional.
# Métrica: hit rate@k "leave-one-out" (¿la última interacción aparece en el top-k?).

import pandas as pd

from app.module.personalization.ml import collaborative_filter
from app.module.personalization.ml.collaborative_filter import CollaborativeModel

FULL_TRUST_INTERACTIONS = 20


def _normalize(scores: dict[str, float]) -> dict[str, float]:
    if not scores:
        return {}
    low, high = min(scores.values()), max(scores.values())
    return {k: (v - low) / (high - low) if high > low else 1.0 for k, v in scores.items()}


# blend => [{"product_id", "score", "source"}] ordenado de mayor a menor
def blend(
    cf: dict[str, float], cbf: dict[str, float], popular: list[str], interactions: int, k: int
) -> list[dict]:
    alpha = min(1.0, interactions / FULL_TRUST_INTERACTIONS)
    cf, cbf = _normalize(cf), _normalize(cbf)
    combined = {
        pid: alpha * cf.get(pid, 0.0) + (1 - alpha) * cbf.get(pid, 0.0) for pid in {*cf, *cbf}
    }
    items = [
        {
            "product_id": pid,
            "score": round(score, 4),
            "source": "hybrid"
            if pid in cf and pid in cbf
            else "collaborative"
            if pid in cf
            else "content",
        }
        for pid, score in sorted(combined.items(), key=lambda kv: -kv[1])[:k]
    ]
    for pid in popular:  # Completa con populares (usuario nuevo o catálogo con pocas señales)
        if len(items) >= k:
            break
        if pid not in combined:
            items.append({"product_id": pid, "score": 0.0, "source": "popular"})
    return items


# hit_rate => evalúa el colaborativo ocultando la última interacción de cada usuario
def hit_rate(interactions: pd.DataFrame, k: int = 10) -> float | None:
    ordered = interactions.sort_values("created_at")
    last = ordered.groupby("user_id").tail(1)
    eligible = last[last["user_id"].map(ordered["user_id"].value_counts()) >= 2]
    if eligible.empty:
        return None
    model: CollaborativeModel | None = collaborative_filter.fit(ordered.drop(eligible.index))
    if model is None:
        return None
    hits = sum(
        row.product_id in collaborative_filter.recommend(model, row.user_id, k)
        for row in eligible.itertuples()
    )
    return round(hits / len(eligible), 4)
