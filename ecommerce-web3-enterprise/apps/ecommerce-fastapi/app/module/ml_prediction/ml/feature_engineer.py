# feature_engineer.py (Pandas + NumPy) => convierte ventas diarias en la matriz de features del
# modelo de demanda. Patrón: Pipeline (serie completa -> lags -> medias móviles -> calendario).
# Paradigma: funcional (funciones puras,
# DataFrame como contrato service <-> ML: Data-Driven). Es la ÚNICA definición de features: el
# entrenamiento y la predicción recursiva la reutilizan, así nunca se desalinean (DRY).

from datetime import date  # Fecha de corte de la serie

import pandas as pd  # Pandas: DataFrames y series temporales

# "list[str]" en mayúsculas => constante del módulo: columnas que recibe el modelo, en este orden
FEATURES = ["lag_1", "lag_7", "lag_14", "rolling_7", "rolling_28", "day_of_week", "month"]


# complete_daily_series => una fila por producto y día (los días sin ventas valen 0: la demanda cero
# también es dato) Entrada: columnas product_id, day, units (salida del repository). "until" =>
# último día de la serie (hoy)
def complete_daily_series(sales: pd.DataFrame, until: date) -> pd.DataFrame:
    if sales.empty:  # Guard clause: sin ventas no hay serie
        return pd.DataFrame(columns=["product_id", "day", "units"])
    # "assign" => copia con la columna convertida (inmutable)
    sales = sales.assign(day=pd.to_datetime(sales["day"]))
    days = pd.date_range(sales["day"].min(), pd.Timestamp(until), freq="D")  # Calendario continuo
    # MultiIndex producto × día => "reindex" rellena los huecos con 0
    index = pd.MultiIndex.from_product(
        [sales["product_id"].unique(), days], names=["product_id", "day"]
    )
    return (
        sales.groupby(["product_id", "day"])["units"]
        .sum()
        .reindex(index, fill_value=0)
        .reset_index()
    )


# build_features => agrega las columnas de FEATURES. Todo se calcula con "shift(1)": el día t solo
# ve datos hasta t-1 (sin fuga de información del futuro). Las primeras 28 filas de cada producto
# quedan con NaN y se descartan.
def build_features(series: pd.DataFrame) -> pd.DataFrame:
    df = series.sort_values(["product_id", "day"]).copy()
    units = df.groupby("product_id")[
        "units"
    ]  # "groupby" => los lags no cruzan de un producto a otro
    for lag in (1, 7, 14):
        df[f"lag_{lag}"] = units.shift(lag)  # f-string => nombre dinámico de columna
    for window in (7, 28):
        # "transform" => resultado alineado al índice original; lambda => función anónima por grupo
        df[f"rolling_{window}"] = units.transform(lambda s, w=window: s.shift(1).rolling(w).mean())
    df["day_of_week"] = df["day"].dt.dayofweek  # 0 = lunes: captura el patrón semanal
    df["month"] = df["day"].dt.month  # Estacionalidad anual
    return df.dropna(subset=FEATURES)
