# test_fraud_reco_pricing.py (pytest) => 5.5: riesgo de fraude, recomendador híbrido y agente de
# precios, con datos sintéticos.

import numpy as np
import pandas as pd

from app.module.fraud_detection.ml import fraud_classifier, isolation_forest
from app.module.fraud_detection.ml.risk_scorer import FEATURES, combine, risk_level, rule_score
from app.module.personalization.ml import collaborative_filter
from app.module.personalization.ml.hybrid_recommender import blend, hit_rate
from app.module.price_optimization.ml import (
    competitor_analyzer,
    elasticity_calculator,
    rl_price_agent,
)

NORMAL = {
    "amount_cents": 90_000,
    "item_count": 2,
    "account_age_days": 400,
    "orders_last_24h": 0,
    "distinct_addresses_30d": 1,
    "payment_attempts": 1,
    "hour_of_day": 15,
    "email_verified": 1,
    "address_mismatch": 0,
}
SUSPICIOUS = {
    **NORMAL,
    "amount_cents": 4_000_000,
    "account_age_days": 0,
    "orders_last_24h": 7,
    "distinct_addresses_30d": 5,
    "payment_attempts": 4,
    "hour_of_day": 3,
    "email_verified": 0,
}


def history(n: int = 300) -> pd.DataFrame:
    rng = np.random.default_rng(5)
    rows = [
        {
            **NORMAL,
            "amount_cents": int(rng.normal(90_000, 20_000)),
            "hour_of_day": int(rng.integers(8, 22)),
        }
        for _ in range(n)
    ]
    return pd.DataFrame(rows)


def test_rules_anomaly_and_levels() -> None:
    assert rule_score(NORMAL) == (0.0, [])
    score, triggered = rule_score(SUSPICIOUS)
    assert score >= 0.9 and "high_velocity" in triggered
    model = isolation_forest.fit(history())
    assert isolation_forest.anomaly_score(model, SUSPICIOUS) > isolation_forest.anomaly_score(
        model, NORMAL
    )
    assert risk_level(combine(score, 0.9, None)) == "HIGH"
    assert risk_level(combine(0.0, 0.1, None)) == "LOW"
    assert isolation_forest.fit(history(10)) is None  # Sin historial suficiente: solo reglas


def test_classifier_needs_both_labels_and_explains() -> None:
    legit = history(30).assign(label=0)
    fraud = pd.DataFrame([SUSPICIOUS] * 30).assign(label=1)
    assert fraud_classifier.fit(legit) is None
    model = fraud_classifier.fit(pd.concat([legit, fraud]))
    probability, shap = fraud_classifier.predict(model, SUSPICIOUS)
    assert probability > 0.5 and set(shap) == set(FEATURES)


def test_collaborative_and_hybrid_recommendations() -> None:
    # Dos "comunidades": usuarios impares prefieren p0-p2, pares p3-p5 (con huecos por recomendar)
    rows = [
        (f"u{u}", f"p{p}", 5.0)
        for u in range(20)
        for p in ((0, 1, 2) if u % 2 else (3, 4, 5))
        if (u + p) % 4
    ]
    signals = pd.DataFrame(rows, columns=["user_id", "product_id", "weight"]).assign(
        created_at=range(len(rows))
    )
    model = collaborative_filter.fit(signals)
    recs = collaborative_filter.recommend(model, "u3", 3)
    assert recs and not set(recs) & model.seen["u3"]  # Nunca recomienda lo ya visto
    assert next(iter(recs)) == "p1"  # u3 no ha visto p1, el único que le falta de su comunidad
    items = blend(recs, {"p9": 0.8}, model.popular, interactions=2, k=4)
    assert len(items) == 4 and {i["source"] for i in items} <= {
        "content",
        "collaborative",
        "hybrid",
        "popular",
    }
    assert hit_rate(signals) is not None


def test_pricing_agent_respects_strategy_and_ceiling() -> None:
    sales = pd.DataFrame({"price_cents": [100, 110, 120, 90, 100], "units": [10, 8, 6, 13, 10]})
    elasticity, method = elasticity_calculator.estimate(sales)
    assert method == "log_log_regression" and elasticity < -1
    assert elasticity_calculator.estimate(sales.iloc[:2]) == (-1.2, "prior")
    rng = np.random.default_rng(0)
    elastic = [elasticity_calculator.expected_units(10, 1.0, m, -2.5) for m in rl_price_agent.ARMS]
    assert rl_price_agent.choose(10_000, elastic, 0.01, "revenue", rng=rng).multiplier == 0.90
    assert rl_price_agent.choose(10_000, elastic, 0.01, "clearance", rng=rng).multiplier == 0.90
    market = competitor_analyzer.analyze(10_000, [9_000, 9_500, 10_000])
    ceiling = competitor_analyzer.ceiling(market)
    flat = [10.0] * 5  # Demanda inelástica: subir conviene, pero el techo competitivo lo limita
    decision = rl_price_agent.choose(10_000, flat, 0.01, "competitive", ceiling, rng=rng)
    assert ceiling is not None and 10_000 * decision.multiplier <= ceiling
