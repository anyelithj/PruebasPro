# test_customer_analytics.py (pytest) => 5.4: RFM, K-Means (silhouette) y LTV (XGBoost o
# heurística).

import numpy as np
import pandas as pd

from app.module.customer_analytics.ml.kmeans_segmentation import segment
from app.module.customer_analytics.ml.ltv_predictor import predict_ltv
from app.module.customer_analytics.ml.rfm_analyzer import rfm_scores, rfm_table

AS_OF = pd.Timestamp("2026-10-04")


# orders => un tercio de clientes leales (compran seguido y caro) y el resto ocasionales
def orders(customers: int) -> pd.DataFrame:
    rng = np.random.default_rng(3)
    rows = []
    for c in range(customers):
        loyal = c % 3 == 0
        # Comportamiento estable en el año: los leales compran seguido durante los 300 días
        for _ in range(rng.integers(20, 30) if loyal else rng.integers(1, 3)):
            days = int(rng.integers(1, 300))
            amount = int(rng.integers(80_000, 150_000) if loyal else rng.integers(10_000, 30_000))
            rows.append(
                {
                    "user_id": f"u{c}",
                    "placed_at": AS_OF - pd.Timedelta(days=days),
                    "total_cents": amount,
                }
            )
    return pd.DataFrame(rows)


def loyal_ids(customers: int) -> list[str]:
    return [f"u{c}" for c in range(0, customers, 3)]


def test_rfm_and_business_segments() -> None:
    scored = rfm_scores(rfm_table(orders(60), AS_OF))
    assert len(scored) == 60
    assert scored[["r_score", "f_score", "m_score"]].isin(range(1, 6)).all().all()
    loyal = scored[scored["user_id"].isin(loyal_ids(60))]
    assert loyal["rfm_segment"].isin(["champions", "loyal"]).mean() > 0.8


def test_kmeans_separates_groups() -> None:
    result = segment(rfm_table(orders(60), AS_OF))
    assert 2 <= result.k <= 6 and result.silhouette > 0.3
    assert result.features.shape == (60, 3)


def test_ltv_xgboost_with_enough_customers_and_heuristic_otherwise() -> None:
    many = predict_ltv(orders(120), AS_OF)
    assert many.method == "xgboost" and (many.ltv_cents >= 0).all()
    assert many.ltv_cents[loyal_ids(120)].mean() > many.ltv_cents.mean()
    few = predict_ltv(orders(6), AS_OF)
    assert few.method == "heuristic" and len(few.ltv_cents) == 6
