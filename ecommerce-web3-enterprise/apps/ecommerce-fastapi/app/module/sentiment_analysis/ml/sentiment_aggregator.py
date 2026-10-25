# sentiment_aggregator.py (Pandas) => métricas agregadas de sentimiento de un periodo.
# Patrón: Pipeline (filas -> conteos -> proporciones -> índice neto). Paradigma: funcional + Data-
# Driven.

import pandas as pd

LABELS = ("positive", "neutral", "negative")


# aggregate => {"total", "counts", "share", "avg_score", "net_sentiment"}.
# net_sentiment = (positivos - negativos) / total, en [-1, 1] (estilo NPS).
def aggregate(results: pd.DataFrame) -> dict:
    total = len(results)
    if total == 0:  # Guard clause: periodo sin análisis
        return {
            "total": 0,
            "counts": dict.fromkeys(LABELS, 0),
            "share": dict.fromkeys(LABELS, 0.0),
            "avg_score": 0.0,
            "net_sentiment": 0.0,
        }
    counts = results["label"].value_counts().reindex(LABELS, fill_value=0)
    return {
        "total": total,
        "counts": {label: int(n) for label, n in counts.items()},
        "share": {label: round(n / total, 4) for label, n in counts.items()},
        "avg_score": round(float(results["score"].mean()), 4),
        "net_sentiment": round((counts["positive"] - counts["negative"]) / total, 4),
    }
