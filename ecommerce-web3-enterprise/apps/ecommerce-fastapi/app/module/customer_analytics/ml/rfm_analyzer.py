# rfm_analyzer.py (Pandas + NumPy) => análisis RFM (Recency, Frequency, Monetary) por cliente y
# segmento de negocio legible (Champions, Loyal, At risk...).
# Patrón: Pipeline (pedidos -> agregados -> quintiles -> reglas). Paradigma: funcional + Data-
# Driven.

import numpy as np
import pandas as pd

RFM_COLUMNS = ["recency_days", "frequency", "monetary_cents"]


# rfm_table => una fila por cliente. "orders": columnas user_id, placed_at, total_cents.
def rfm_table(orders: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    if orders.empty:
        return pd.DataFrame(columns=["user_id", *RFM_COLUMNS])
    grouped = orders.groupby("user_id").agg(
        last=("placed_at", "max"),
        frequency=("placed_at", "count"),
        monetary_cents=("total_cents", "sum"),
    )
    grouped["recency_days"] = (as_of - grouped["last"]).dt.days
    return grouped.reset_index()[["user_id", *RFM_COLUMNS]]


# _quintile => puntaje 1-5 por percentil; "ascending=False" en recencia: menos días = mejor
def _quintile(values: pd.Series, ascending: bool = True) -> pd.Series:
    return (
        np.ceil(values.rank(pct=True, ascending=ascending, method="average") * 5)
        .clip(1, 5)
        .astype(int)
    )


# rfm_scores => agrega r/f/m_score (1-5) y el segmento de negocio por reglas
def rfm_scores(rfm: pd.DataFrame) -> pd.DataFrame:
    if rfm.empty:
        return rfm.assign(r_score=[], f_score=[], m_score=[], rfm_segment=[])
    scored = rfm.assign(
        r_score=_quintile(rfm["recency_days"], ascending=False),
        f_score=_quintile(rfm["frequency"]),
        m_score=_quintile(rfm["monetary_cents"]),
    )
    r, f = scored["r_score"], scored["f_score"]
    # "np.select" => primera condición verdadera gana (orden = prioridad de las reglas)
    scored["rfm_segment"] = np.select(
        [
            (r >= 4) & (f >= 4),
            f >= 4,
            (r >= 4) & (f <= 2),
            (r <= 2) & (f >= 3),
            (r <= 2) & (f <= 2),
        ],
        ["champions", "loyal", "new", "at_risk", "hibernating"],
        default="potential",
    )
    return scored
