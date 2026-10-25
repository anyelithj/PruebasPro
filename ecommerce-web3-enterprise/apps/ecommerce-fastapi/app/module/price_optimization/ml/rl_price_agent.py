# rl_price_agent.py (NumPy) => agente de precios con bandido contextual (Thompson Sampling): cada
# "brazo" es un multiplicador de precio acotado (±10 %); el agente muestrea el ingreso esperado de
# cada brazo según su incertidumbre y elige el mejor muestreo. Explora más cuando hay pocos datos y
# explota cuando la estimación es confiable. Decisión v35: bandido en NumPy en lugar de
# stable-baselines3 (exige PyTorch) — mismo objetivo de RL con una fracción del cómputo.
# Patrón: Strategy (objetivo por estrategia). Paradigma: funcional (con aleatoriedad controlada).

from dataclasses import dataclass

import numpy as np

ARMS = [0.90, 0.95, 1.00, 1.05, 1.10]  # Límite de ±10 %: protege al cliente y a la marca


@dataclass(frozen=True)
class Decision:
    multiplier: float
    expected_units: float
    expected_revenue_cents: float
    arms: list[dict]  # Estimación de cada brazo (explicación de la decisión)


# choose => "units" = unidades diarias estimadas en cada brazo; "uncertainty" (0-1) = qué tanto
# desconfiar de la estimación (alta sin historial). "strategy": revenue | clearance | competitive
def choose(
    price_cents: int,
    units: list[float],
    uncertainty: float,
    strategy: str,
    ceiling_cents: int | None = None,
    rng: np.random.Generator | None = None,
) -> Decision:
    rng = rng or np.random.default_rng()
    revenue = np.array([price_cents * m * u for m, u in zip(ARMS, units, strict=True)])
    samples = rng.normal(revenue, np.maximum(revenue * uncertainty, 1e-9))  # Thompson Sampling
    if strategy == "clearance":  # Liquidar inventario: maximizar unidades, no ingreso
        samples = rng.normal(np.array(units), np.maximum(np.array(units) * uncertainty, 1e-9))
    allowed = np.array([ceiling_cents is None or price_cents * m <= ceiling_cents for m in ARMS])
    if not allowed.any():  # Ni el -10 % entra bajo el techo competitivo: brazo más bajo
        allowed[0] = True
    best = int(np.argmax(np.where(allowed, samples, -np.inf)))
    arms = [
        {"multiplier": m, "units": round(u, 3), "revenue_cents": round(float(r))}
        for m, u, r in zip(ARMS, units, revenue, strict=True)
    ]
    return Decision(ARMS[best], round(units[best], 3), round(float(revenue[best])), arms)
