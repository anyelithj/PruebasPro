# competitor_analyzer.py (NumPy) => posición frente a precios de la competencia y límites para la
# estrategia "competitive". Los precios de competidores llegan en la petición (los aporta el equipo
# comercial o una integración autorizada): no se hace scraping de sitios de terceros.
# Patrón: Pipeline (precios -> estadísticos -> límite). Paradigma: funcional.

import numpy as np


# analyze => {"min", "median", "max", "position"} o None si no hay precios de referencia
def analyze(own_price: int, competitor_prices: list[int]) -> dict | None:
    if not competitor_prices:
        return None
    prices = np.asarray(competitor_prices, dtype=float)
    median = float(np.median(prices))
    position = (
        "below"
        if own_price < median * 0.98
        else "above"
        if own_price > median * 1.02
        else "at_market"
    )
    return {
        "min": int(prices.min()),
        "median": int(median),
        "max": int(prices.max()),
        "position": position,
    }


# ceiling => precio máximo para la estrategia "competitive": no más de 2 % sobre la mediana
def ceiling(market: dict | None) -> int | None:
    return None if market is None else int(market["median"] * 1.02)
