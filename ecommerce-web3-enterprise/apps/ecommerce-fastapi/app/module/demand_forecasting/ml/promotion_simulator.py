# promotion_simulator.py (NumPy + Pandas) => RF-24.14 simula el impacto de una promoción o evento
# especial (Black Friday, Cyber Monday, Navidad) sobre la demanda de un producto.
#   demanda con promo = línea base x efecto precio x efecto evento
#   efecto precio  = (1 - descuento) ^ elasticidad          (elasticidad negativa => más unidades)
#   efecto evento  = alza histórica de esa fecha (año pasado vs. 28 días previos) o valor típico
#   "resaca"       = tras la promo la demanda cae unos días (compras adelantadas)
# Paradigma: funcional (funciones puras). Patrones: Strategy (multiplicadores por evento) +
# Pipeline (base -> precio -> evento -> resaca).

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

# Alza típica del retail cuando no hay historia propia de ese evento
DEFAULT_LIFT = {"NONE": 1.0, "BLACK_FRIDAY": 2.5, "CYBER_MONDAY": 2.0, "CHRISTMAS": 1.8}
HANGOVER_DAYS = 7  # Días de "resaca" después de la promoción
HANGOVER_DIP = 0.15  # Caída de la demanda durante la resaca (15 %)
BASELINE_WINDOW = 28


@dataclass(frozen=True)
class Simulation:
    days: list[dict]  # {date, baseline, simulated}
    baseline_units: float
    simulated_units: float
    incremental_units: float
    baseline_revenue_cents: int
    simulated_revenue_cents: int
    event_lift: float
    price_effect: float
    lift_source: str  # "history" | "default"


# event_dates => fechas del evento en un año (Black Friday = 4.º viernes de noviembre)
def event_window(event: str, year: int) -> tuple[date, date] | None:
    if event == "NONE":
        return None
    november_first = date(year, 11, 1)
    first_friday = november_first + timedelta(days=(4 - november_first.weekday()) % 7)
    black_friday = first_friday + timedelta(weeks=3)
    windows = {
        "BLACK_FRIDAY": (black_friday, black_friday + timedelta(days=2)),
        "CYBER_MONDAY": (black_friday + timedelta(days=3), black_friday + timedelta(days=3)),
        "CHRISTMAS": (date(year, 12, 15), date(year, 12, 24)),
    }
    return windows.get(event)


# historical_lift => cuánto vendió en el evento del año pasado frente a los 28 días anteriores
def historical_lift(history: pd.DataFrame, event: str, today: date) -> float | None:
    window = event_window(event, today.year - 1)
    if window is None or history.empty:
        return None
    days = pd.to_datetime(history["day"]).dt.date
    during = history.loc[(days >= window[0]) & (days <= window[1]), "units"]
    before_start = window[0] - timedelta(days=BASELINE_WINDOW)
    before = history.loc[(days >= before_start) & (days < window[0]), "units"]
    if during.empty or before.mean() <= 0:
        return None
    return float(np.clip(during.mean() / before.mean(), 1.0, 10.0))


def simulate(
    history: pd.DataFrame,
    price_cents: int,
    discount: float,
    elasticity: float,
    event: str,
    start: date,
    promo_days: int,
    horizon_days: int,
) -> Simulation:
    recent = history.sort_values("day").tail(BASELINE_WINDOW)["units"]
    base = float(recent.mean()) if not recent.empty else 0.0
    lift = historical_lift(history, event, start)
    event_lift, source = (lift, "history") if lift is not None else (DEFAULT_LIFT[event], "default")
    price_effect = float((1 - discount) ** elasticity) if discount > 0 else 1.0
    days: list[dict] = []
    for offset in range(horizon_days):
        day = start + timedelta(days=offset)
        in_promo = offset < promo_days
        in_hangover = promo_days <= offset < promo_days + HANGOVER_DAYS and (
            discount > 0 or event != "NONE"
        )
        factor = (
            event_lift * price_effect if in_promo else (1 - HANGOVER_DIP if in_hangover else 1.0)
        )
        days.append(
            {
                "date": day.isoformat(),
                "baseline": round(base, 2),
                "simulated": round(base * factor, 2),
                "promo": in_promo,
            }
        )
    baseline_units = base * horizon_days
    simulated_units = sum(d["simulated"] for d in days)
    promo_price = price_cents * (1 - discount)
    simulated_revenue = sum(
        d["simulated"] * (promo_price if d["promo"] else price_cents) for d in days
    )
    return Simulation(
        days=days,
        baseline_units=round(baseline_units, 2),
        simulated_units=round(simulated_units, 2),
        incremental_units=round(simulated_units - baseline_units, 2),
        baseline_revenue_cents=int(baseline_units * price_cents),
        simulated_revenue_cents=int(simulated_revenue),
        event_lift=round(event_lift, 3),
        price_effect=round(price_effect, 3),
        lift_source=source,
    )
