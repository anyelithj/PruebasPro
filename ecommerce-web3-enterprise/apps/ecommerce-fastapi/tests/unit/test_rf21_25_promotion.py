# test_rf21_25_promotion.py (pytest) => RF-24.14 simulador de promociones (función pura, sin BD).

from datetime import date, timedelta

import pandas as pd

from app.module.demand_forecasting.ml import promotion_simulator


def _history(units: float = 10.0, days: int = 60) -> pd.DataFrame:
    start = date(2026, 8, 1)
    return pd.DataFrame(
        {"day": [start + timedelta(days=i) for i in range(days)], "units": [units] * days}
    )


def test_black_friday_window_is_fourth_friday_of_november() -> None:
    start, end = promotion_simulator.event_window("BLACK_FRIDAY", 2026)
    assert start == date(2026, 11, 27) and start.weekday() == 4
    assert end == date(2026, 11, 29)


def test_discount_with_elastic_demand_increases_units_and_has_hangover() -> None:
    result = promotion_simulator.simulate(
        _history(), 10_000, 0.2, -1.5, "NONE", date(2026, 10, 1), 3, 14
    )
    assert result.price_effect > 1  # (0.8)^-1.5 ≈ 1.398
    assert result.days[0]["simulated"] > result.days[0]["baseline"]
    assert result.days[3]["simulated"] < result.days[3]["baseline"]  # Resaca tras la promoción
    assert result.lift_source == "default"


def test_event_uses_default_lift_without_history() -> None:
    result = promotion_simulator.simulate(
        _history(), 10_000, 0.0, -1.2, "CHRISTMAS", date(2026, 12, 15), 5, 10
    )
    assert result.event_lift == promotion_simulator.DEFAULT_LIFT["CHRISTMAS"]
    assert result.incremental_units > 0
