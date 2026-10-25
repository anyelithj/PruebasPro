# xgboost_trainer.py (XGBoost + Prophet + MLflow) => entrena y usa los modelos de demanda diaria.
# Patrón: Strategy (DemandTrainer: train/forecast/explain) + Template Method (la base fija los pasos
# y el ensamble redefine solo los que cambian) + Registry/Factory (TRAINERS: nombre -> estrategia;
# un modelo nuevo = una clase registrada, sin tocar el service: OCP).
# Paradigma: POO (estrategias como clases, herencia) + Data-Driven (DataFrames de entrada y salida).

from dataclasses import dataclass  # Resultado inmutable del entrenamiento
from datetime import date, timedelta  # Fechas del pronóstico
from pathlib import Path  # Ruta del artefacto
from typing import Any, Protocol  # Protocol => interfaz estructural (duck typing tipado)

import joblib
import mlflow
import numpy as np
import pandas as pd
from xgboost import DMatrix, XGBRegressor  # Gradient boosting de árboles (regresión)

from app.config.mlflow_config import configure_mlflow
from app.module.demand_forecasting.ml.prophet_model import prophet_forecast
from app.module.ml_prediction.ml.feature_engineer import FEATURES, build_features
from app.module.ml_prediction.ml.model_evaluator import evaluate
from app.shared.constants.ml_constants import (
    MAX_PROPHET_VALIDATION_PRODUCTS,
    MIN_TRAINING_DAYS,
    RANDOM_STATE,
    VALIDATION_RATIO,
)
from app.shared.util.metrics_util import inverse_error_weight, regression_metrics


# TrainingResult => Value Object con todo lo que el service persiste en ModelVersion
@dataclass(frozen=True)
class TrainingResult:
    artifact_path: str
    metrics: dict[str, float]
    mlflow_run_id: str


# DemandTrainer => contrato de cualquier estrategia de demanda (interfaz; ISP: 3 operaciones)
class DemandTrainer(Protocol):
    def train(self, series: pd.DataFrame, artifact_path: Path) -> TrainingResult: ...
    def forecast(self, model: Any, history: pd.DataFrame, horizon: int) -> list[dict[str, Any]]: ...
    def explain(self, model: Any, history: pd.DataFrame) -> dict[str, Any]: ...


# next_day_features => fila de features del día siguiente al último de "series" (un producto).
# Solo usa las últimas 29 filas: suficiente para lag_14 y rolling_28 (O(1) por paso, no O(n)).
def next_day_features(series: pd.DataFrame) -> pd.DataFrame:
    next_day = series["day"].max() + timedelta(days=1)
    row = pd.DataFrame(
        {"product_id": [series["product_id"].iloc[0]], "day": [next_day], "units": [0.0]}
    )
    return build_features(pd.concat([series.tail(29), row], ignore_index=True)).tail(1)


class XGBoostDemandTrainer:
    NAME = "demand-xgboost"  # Clave del registro y nombre del experimento en MLflow
    # Hiperparámetros como atributo de clase (un solo lugar; se registran en MLflow).
    # "n_jobs=2" => limita los hilos de CPU: entrenamiento algo más lento pero sin acaparar la
    # máquina
    PARAMS = {
        "n_estimators": 300,
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "n_jobs": 2,
        "random_state": RANDOM_STATE,
    }

    # split => features + partición TEMPORAL (valida con el último 20 % del calendario: nunca
    # entrena con días posteriores a los que evalúa)
    def split(self, series: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        # Sin ventas no hay features: 0 días (mismo error claro que un historial corto)
        dataset = build_features(series) if not series.empty else series
        days = dataset["day"].drop_duplicates().sort_values()
        # Guard clause: con poco historial el modelo no aprende el ciclo semanal
        if len(days) < MIN_TRAINING_DAYS:
            raise ValueError(
                f"Historial insuficiente: {len(days)} días; se requieren {MIN_TRAINING_DAYS}"
            )
        cutoff = days.iloc[int(len(days) * (1 - VALIDATION_RATIO))]
        return dataset, dataset[dataset["day"] < cutoff], dataset[dataset["day"] >= cutoff]

    def fit(self, frame: pd.DataFrame) -> XGBRegressor:
        model = XGBRegressor(**self.PARAMS)  # "**dict" => desempaqueta el dict como argumentos
        model.fit(frame[FEATURES], frame["units"])
        return model

    # validate => (artefacto final, métricas de validación). La base: solo XGBoost.
    # Template Method: el ensamble redefine este paso y reutiliza el resto de "train".
    def validate(
        self, series: pd.DataFrame, dataset, train, validation
    ) -> tuple[Any, dict[str, float]]:
        metrics = evaluate(self.fit(train), validation)
        return self.fit(dataset), metrics  # Reentrena con TODO el historial para producción

    def train(self, series: pd.DataFrame, artifact_path: Path) -> TrainingResult:
        dataset, train, validation = self.split(series)
        configure_mlflow(self.NAME)
        # "with mlflow.start_run()" => context manager: cierra el run aunque falle el entrenamiento
        with mlflow.start_run() as run:
            artifact, metrics = self.validate(series, dataset, train, validation)
            artifact_path.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(artifact, artifact_path)
            mlflow.log_params(self.PARAMS)
            mlflow.log_metrics(metrics)
            mlflow.log_artifact(str(artifact_path))  # Copia el .joblib al experimento
        return TrainingResult(str(artifact_path), metrics, run.info.run_id)

    # forecast => predicción RECURSIVA: cada día predicho se agrega a la historia y alimenta los
    # lags del siguiente. "history" => serie diaria completa de UN producto (product_id, day,
    # units).
    def forecast(self, model: Any, history: pd.DataFrame, horizon: int) -> list[dict[str, Any]]:
        series = history[["product_id", "day", "units"]].copy()
        points: list[dict[str, Any]] = []
        for _ in range(horizon):  # "_" => variable de iteración que no se usa
            features = next_day_features(series)
            units = max(0.0, float(model.predict(features[FEATURES])[0]))  # Demanda no negativa
            series = pd.concat(
                [series, features[["product_id", "day"]].assign(units=units)], ignore_index=True
            )
            points.append(
                {"date": features["day"].iloc[0].date().isoformat(), "units": round(units, 2)}
            )
        return points

    # explain => valores SHAP del primer día predicho con TreeSHAP NATIVO de XGBoost
    # ("pred_contribs=True"): explicabilidad sin instalar la librería "shap" (menos dependencias y
    # RAM). base_value + suma(contributions) = predicción del modelo.
    def explain(self, model: Any, history: pd.DataFrame) -> dict[str, Any]:
        row = next_day_features(history[["product_id", "day", "units"]])
        values = model.get_booster().predict(DMatrix(row[FEATURES]), pred_contribs=True)[0]
        # "sorted(..., key=abs)" => primero las features que más mueven la predicción
        ranked = sorted(zip(FEATURES, values[:-1], strict=True), key=lambda pair: -abs(pair[1]))
        return {
            "base_value": round(float(values[-1]), 4),
            "contributions": {k: round(float(v), 4) for k, v in ranked},
        }


# XGBoostProphetEnsembleTrainer => ensamble ponderado por error inverso: el modelo que menos se
# equivocó en validación pesa más. Hereda split/fit/train/explain (DRY) y redefine
# validate/forecast.
class XGBoostProphetEnsembleTrainer(XGBoostDemandTrainer):
    NAME = "demand-ensemble"

    def validate(
        self, series: pd.DataFrame, dataset, train, validation
    ) -> tuple[Any, dict[str, float]]:
        xgb_val = self.fit(train)
        # Productos con más unidades: Prophet se ajusta uno por uno (límite = ahorro de CPU/energía)
        top = (
            train.groupby("product_id")["units"]
            .sum()
            .nlargest(MAX_PROPHET_VALIDATION_PRODUCTS)
            .index
        )
        val = validation[validation["product_id"].isin(top)].sort_values(["product_id", "day"])
        cutoff = val["day"].min()
        prophet_pred = np.concatenate(
            [
                prophet_forecast(
                    series[(series["product_id"] == pid) & (series["day"] < cutoff)], len(group)
                )
                for pid, group in val.groupby("product_id")  # Mismo orden que "val"
            ]
        )
        xgb_pred = np.clip(xgb_val.predict(val[FEATURES]), 0, None)
        rmse_xgb = regression_metrics(val["units"], xgb_pred)["rmse"]
        rmse_prophet = regression_metrics(val["units"], prophet_pred)["rmse"]
        weight = inverse_error_weight(rmse_xgb, rmse_prophet)  # Peso del XGBoost
        metrics = regression_metrics(val["units"], weight * xgb_pred + (1 - weight) * prophet_pred)
        metrics |= {
            "xgb_weight": round(weight, 4),
            "rmse_xgb": rmse_xgb,
            "rmse_prophet": rmse_prophet,
        }
        # Artefacto = dict: el XGBoost de producción + el peso del ensamble (Prophet se ajusta al
        # predecir con la historia reciente del producto: siempre actual y sin guardar un modelo por
        # producto)
        return {"xgb": self.fit(dataset), "xgb_weight": weight}, metrics

    def forecast(self, model: Any, history: pd.DataFrame, horizon: int) -> list[dict[str, Any]]:
        points = super().forecast(model["xgb"], history, horizon)  # "super()" => estrategia base
        prophet = prophet_forecast(history, horizon)
        weight = model["xgb_weight"]
        # "zip(..., strict=True)" => falla si las longitudes difieren (nunca debería pasar)
        return [
            {
                "date": point["date"],
                "units": round(weight * point["units"] + (1 - weight) * float(p), 2),
            }
            for point, p in zip(points, prophet, strict=True)
        ]

    def explain(self, model: Any, history: pd.DataFrame) -> dict[str, Any]:
        # Explica el componente XGBoost (Prophet es aditivo y no aporta contribuciones por feature)
        return super().explain(model["xgb"], history) | {"xgb_weight": model["xgb_weight"]}


# Registry/Factory de estrategias: la clave es el "model_name" de la API y de ModelVersion
TRAINERS: dict[str, type[DemandTrainer]] = {
    trainer.NAME: trainer for trainer in (XGBoostDemandTrainer, XGBoostProphetEnsembleTrainer)
}


# history_start => primer día de historia que necesita forecast (≥ 29 días para las features;
# 60 para que Prophet vea ~8 semanas) — el repository no lee toda la tabla
def history_start(today: date) -> date:
    return today - timedelta(days=60)
