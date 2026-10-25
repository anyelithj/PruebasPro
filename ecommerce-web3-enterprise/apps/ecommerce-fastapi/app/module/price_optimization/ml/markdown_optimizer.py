# markdown_optimizer.py (Python estándar + elasticidad) => RF-18.10 optimización de rebajas
# (markdown): calendario semanal de descuentos para vender el inventario dentro de un horizonte,
# con balance CONFIGURABLE entre ingresos y utilidad.
#   objetivo = w * ingresos + (1 - w) * utilidad        (w = revenue_weight, 0..1)
#   utilidad = ingresos + valor de rescate del sobrante - costo del inventario
# Búsqueda exhaustiva de calendarios NO decrecientes (una rebaja no se revierte: práctica de retail
# y evita entrenar al cliente a esperar). Con 6 niveles y 4 semanas son 126 calendarios => exacto
# y en microsegundos (sin solver externo).
# Patrón: Strategy (la demanda se inyecta: elasticidad o XGBoost) + Value Object (MarkdownPlan).
# Paradigma: funcional (funciones puras, sin estado).

from collections.abc import Callable
from dataclasses import dataclass, field
from itertools import combinations_with_replacement

DISCOUNTS = (0.0, 0.1, 0.2, 0.3, 0.4, 0.5)  # Niveles permitidos (0 % a 50 %)

# Demand => unidades por semana a un multiplicador de precio (1.0 = precio actual)
Demand = Callable[[float], float]


@dataclass(frozen=True)
class MarkdownPlan:
    schedule: list[float]  # Descuento por semana (0.2 = 20 %)
    units: list[float]  # Unidades esperadas por semana
    revenue_cents: int
    profit_cents: int
    leftover_units: float
    sell_through: float  # % del inventario vendido
    objective: float
    alternatives: list[dict] = field(default_factory=list)  # Mejores calendarios (comparación)


# simulate => vende semana a semana sin superar el inventario restante
def simulate(
    schedule: tuple[float, ...],
    price_cents: int,
    stock: int,
    demand: Demand,
    unit_cost_cents: float,
    salvage_rate: float,
) -> tuple[list[float], float, float, float]:
    remaining = float(stock)
    units: list[float] = []
    revenue = 0.0
    for discount in schedule:
        sold = min(remaining, max(0.0, demand(1 - discount)))
        units.append(round(sold, 2))
        revenue += sold * price_cents * (1 - discount)
        remaining -= sold
    profit = revenue + remaining * unit_cost_cents * salvage_rate - stock * unit_cost_cents
    return units, revenue, profit, remaining


# optimize => mejor calendario según el objetivo ponderado (y las 3 alternativas siguientes)
def optimize(
    price_cents: int,
    stock: int,
    weeks: int,
    demand: Demand,
    unit_cost_cents: float,
    revenue_weight: float = 0.5,
    salvage_rate: float = 0.3,
    discounts: tuple[float, ...] = DISCOUNTS,
) -> MarkdownPlan:
    scored = []
    # combinations_with_replacement sobre niveles ordenados => calendarios no decrecientes
    for schedule in combinations_with_replacement(discounts, weeks):
        units, revenue, profit, left = simulate(
            schedule, price_cents, stock, demand, unit_cost_cents, salvage_rate
        )
        objective = revenue_weight * revenue + (1 - revenue_weight) * profit
        scored.append((objective, schedule, units, revenue, profit, left))
    scored.sort(key=lambda row: row[0], reverse=True)
    best = scored[0]
    sold_ratio = (stock - best[5]) / stock if stock else 0.0
    return MarkdownPlan(
        schedule=list(best[1]),
        units=best[2],
        revenue_cents=int(best[3]),
        profit_cents=int(best[4]),
        leftover_units=round(best[5], 2),
        sell_through=round(sold_ratio, 3),
        objective=round(best[0], 2),
        alternatives=[
            {
                "schedule": list(row[1]),
                "revenue_cents": int(row[3]),
                "profit_cents": int(row[4]),
                "leftover_units": round(row[5], 2),
            }
            for row in scored[1:4]
        ],
    )
