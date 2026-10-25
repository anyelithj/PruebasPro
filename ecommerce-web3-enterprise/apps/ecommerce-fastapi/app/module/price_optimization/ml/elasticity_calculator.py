# elasticity_calculator.py (NumPy + Pandas) => elasticidad precio-demanda de un producto:
# pendiente de la regresión log(unidades) ~ log(precio). -1.5 => si el precio sube 1 %, la demanda
# cae ~1,5 %. Sin variación de precios suficiente se usa un valor previo prudente (-1.2, típico de
# retail) en lugar de inventar una pendiente con ruido.
# Patrón: Pipeline (ventas -> logaritmos -> mínimos cuadrados). Paradigma: funcional.

import numpy as np
import pandas as pd

PRIOR_ELASTICITY = -1.2
MIN_PRICE_POINTS = 3  # Precios distintos necesarios para estimar una pendiente


# estimate => (elasticidad, método). "sales": columnas price_cents, units (una fila por día)
def estimate(sales: pd.DataFrame) -> tuple[float, str]:
    if sales.empty or sales["price_cents"].nunique() < MIN_PRICE_POINTS:
        return PRIOR_ELASTICITY, "prior"
    # Recta: grado 1
    slope, _ = np.polyfit(np.log(sales["price_cents"]), np.log1p(sales["units"]), deg=1)
    # Rango plausible: demanda que baja con el precio, sin extremos por ruido
    return round(float(np.clip(slope, -5.0, -0.1)), 4), "log_log_regression"


# expected_units => demanda a "price" partiendo de (base_price, base_units) con elasticidad
# constante
def expected_units(base_units: float, base_price: float, price: float, elasticity: float) -> float:
    return base_units * (price / base_price) ** elasticity
