# risk_scorer.py (NumPy) => puntaje de riesgo 0-1: combina reglas expertas, anomalía (Isolation
# Forest) y clasificador supervisado (XGBoost) con pesos renormalizados según las señales
# disponibles. Patrón: Pipeline (señales -> combinación -> nivel) + Strategy (cada señal es
# opcional). Paradigma: funcional + Data-Driven (las reglas son datos: nombre, condición, peso).

from collections.abc import Callable
from typing import Any

FEATURES = [
    "amount_cents",
    "item_count",
    "account_age_days",
    "orders_last_24h",
    "distinct_addresses_30d",
    "payment_attempts",
    "hour_of_day",
    "email_verified",
    "address_mismatch",
]
# (nombre, condición, peso): rule_score recorta la suma a 1.0
RULES: list[tuple[str, Callable[[dict[str, Any]], bool], float]] = [
    ("new_account", lambda f: f["account_age_days"] < 2, 0.20),
    ("high_velocity", lambda f: f["orders_last_24h"] >= 5, 0.25),
    ("many_addresses", lambda f: f["distinct_addresses_30d"] >= 4, 0.15),
    ("payment_retries", lambda f: f["payment_attempts"] >= 3, 0.15),
    ("address_mismatch", lambda f: bool(f["address_mismatch"]), 0.10),
    ("unverified_email", lambda f: not f["email_verified"], 0.10),
    ("night_purchase", lambda f: 0 <= f["hour_of_day"] <= 5, 0.05),
    # RF-08.11 (solo reglas: no entran a FEATURES para no invalidar los modelos ya entrenados).
    # ".get" => análisis antiguos sin estas señales siguen funcionando
    ("multi_account_device", lambda f: f.get("accounts_on_device", 1) >= 3, 0.25),
    ("ip_geo_mismatch", lambda f: bool(f.get("ip_country_mismatch")), 0.10),
    ("new_ip", lambda f: bool(f.get("new_ip")), 0.05),
    ("velocity_burst", lambda f: f.get("checkouts_last_hour", 0) >= 3, 0.20),
]
WEIGHTS = {"rules": 0.4, "anomaly": 0.3, "classifier": 0.3}


def rule_score(features: dict[str, Any]) -> tuple[float, list[str]]:
    triggered = [(name, weight) for name, condition, weight in RULES if condition(features)]
    return round(min(1.0, sum(w for _, w in triggered)), 4), [name for name, _ in triggered]


# combine => promedio ponderado de las señales presentes (las ausentes no penalizan ni favorecen)
def combine(rules: float, anomaly: float | None, classifier: float | None) -> float:
    signals = {"rules": rules, "anomaly": anomaly, "classifier": classifier}
    present = {name: value for name, value in signals.items() if value is not None}
    total = sum(WEIGHTS[name] for name in present)
    return round(sum(WEIGHTS[name] * value for name, value in present.items()) / total, 4)


def risk_level(score: float) -> str:
    return "HIGH" if score >= 0.7 else "MEDIUM" if score >= 0.4 else "LOW"  # Expresión condicional
