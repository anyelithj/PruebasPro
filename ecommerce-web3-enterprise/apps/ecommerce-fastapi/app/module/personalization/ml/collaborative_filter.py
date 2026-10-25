# collaborative_filter.py (scikit-learn TruncatedSVD + FAISS) => filtrado colaborativo implícito:
# factoriza la matriz usuario × producto (vistas, carrito, compras con pesos) en factores latentes y
# recomienda los productos cuyo factor más se alinea con el del usuario.
# TruncatedSVD trabaja sobre matrices dispersas (scipy.sparse): memoria proporcional a las
# interacciones reales, no a usuarios × productos. FAISS hace el top-k en C++.
# Patrón: Strategy (recomendador intercambiable). Paradigma: funcional + Data-Driven.

import math
from dataclasses import dataclass

import faiss
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD

from app.shared.constants.ml_constants import RANDOM_STATE

EVENT_WEIGHTS = {"VIEW": 1.0, "WISHLIST": 2.0, "CART": 3.0, "PURCHASE": 5.0}
MAX_FACTORS = 32


@dataclass(frozen=True)
class CollaborativeModel:
    user_index: dict[str, int]
    item_ids: list[str]
    user_factors: np.ndarray  # (usuarios, k)
    item_factors: np.ndarray  # (productos, k)
    seen: dict[str, set[str]]  # Productos con los que ya interactuó cada usuario
    popular: list[str]  # Respaldo para usuarios nuevos (más interacciones ponderadas)


# fit => "interactions": columnas user_id, product_id, weight (varias filas por par se suman)
def fit(interactions: pd.DataFrame) -> CollaborativeModel | None:
    totals = interactions.groupby(["user_id", "product_id"])["weight"].sum().reset_index()
    users, items = totals["user_id"].astype("category"), totals["product_id"].astype("category")
    if users.cat.categories.size < 2 or items.cat.categories.size < 2:
        return None  # Sin al menos 2 usuarios y 2 productos no hay "colaboración" que aprender
    matrix = csr_matrix(
        # log1p: suaviza heavy users
        (np.log1p(totals["weight"]), (users.cat.codes, items.cat.codes)),
        shape=(users.cat.categories.size, items.cat.categories.size),
    )
    # k ≈ √(dimensión menor), tope MAX_FACTORS: con k cercano al rango la SVD reconstruye la matriz
    # casi exacta y los productos no vistos puntúan ~0 (no generaliza); menos factores = menos CPU
    k = max(1, min(MAX_FACTORS, int(math.sqrt(min(matrix.shape)))))
    svd = TruncatedSVD(n_components=k, random_state=RANDOM_STATE)
    user_factors = svd.fit_transform(matrix).astype(np.float32)
    item_factors = svd.components_.T.astype(np.float32)
    seen = totals.groupby("user_id", observed=True)["product_id"].agg(set).to_dict()
    popular = (
        totals.groupby("product_id", observed=True)["weight"]
        .sum()
        .sort_values(ascending=False)
        .index.tolist()
    )
    return CollaborativeModel(
        user_index={u: i for i, u in enumerate(users.cat.categories)},
        item_ids=list(items.cat.categories),
        user_factors=user_factors,
        item_factors=item_factors,
        seen={str(u): set(map(str, p)) for u, p in seen.items()},
        popular=[str(p) for p in popular],
    )


# recommend => {product_id: score} (sin productos ya vistos); vacío si el usuario no está en el
# modelo
def recommend(model: CollaborativeModel, user_id: str, k: int) -> dict[str, float]:
    if user_id not in model.user_index:
        return {}
    # Producto interno factor usuario · producto
    index = faiss.IndexFlatIP(model.item_factors.shape[1])
    index.add(model.item_factors)
    query = model.user_factors[model.user_index[user_id]][None]
    scores, positions = index.search(
        query, min(len(model.item_ids), k + len(model.seen.get(user_id, ())))
    )
    seen = model.seen.get(user_id, set())
    ranked = [
        (model.item_ids[p], float(s))
        for s, p in zip(scores[0], positions[0], strict=True)
        if model.item_ids[p] not in seen
    ]
    return dict(ranked[:k])
