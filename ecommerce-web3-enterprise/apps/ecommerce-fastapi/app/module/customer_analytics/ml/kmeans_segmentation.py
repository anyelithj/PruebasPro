# kmeans_segmentation.py (scikit-learn) => clustering K-Means de clientes sobre RFM.
# El número de grupos (k) se elige automáticamente por el mayor coeficiente silhouette (2 a 6).
# Patrón: Strategy (algoritmo de segmentación intercambiable) + Pipeline (log -> escala -> K-Means).
# Paradigma: funcional + Data-Driven.

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from app.module.customer_analytics.ml.rfm_analyzer import RFM_COLUMNS
from app.shared.constants.ml_constants import RANDOM_STATE

MAX_K = 6


@dataclass(frozen=True)
class Segmentation:
    labels: np.ndarray  # Cluster de cada cliente
    features: np.ndarray  # RFM estandarizado (n, 3): también se guarda en pgvector
    k: int
    silhouette: float  # -1 a 1: qué tan separados están los grupos
    inertia: float  # Suma de distancias al centro (menor = grupos más compactos)


def segment(rfm: pd.DataFrame) -> Segmentation:
    # "log1p" => comprime las colas largas (un cliente que gastó 100x no domina la escala)
    features = StandardScaler().fit_transform(np.log1p(rfm[RFM_COLUMNS].to_numpy(dtype=float)))
    n = len(features)
    if n < 3:  # Guard clause: con menos de 3 clientes no hay grupos que separar
        return Segmentation(np.zeros(n, dtype=int), features, 1 if n else 0, 0.0, 0.0)
    best: tuple[float, KMeans] | None = None
    for k in range(2, min(MAX_K, n - 1) + 1):
        # "n_init=10" => 10 arranques y se queda con el mejor (más estable que 1, aún barato)
        model = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE).fit(features)
        score = silhouette_score(features, model.labels_)
        if best is None or score > best[0]:
            best = (score, model)
    if best is None:  # n == 3: solo cabe k=2 => ya cubierto; resguardo de tipos
        return Segmentation(np.zeros(n, dtype=int), features, 1, 0.0, 0.0)
    score, model = best
    return Segmentation(
        model.labels_,
        features,
        model.n_clusters,
        round(float(score), 4),
        round(float(model.inertia_), 4),
    )
