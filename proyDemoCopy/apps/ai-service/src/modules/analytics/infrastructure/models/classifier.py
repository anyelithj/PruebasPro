"""Modelos de analítica con scikit-learn: dificultad real (KMeans) y respuestas atípicas (IsolationForest).

[Patrón]: Adapter (scikit-learn detrás de funciones del dominio) + Strategy con respaldo determinista.
[Principio]: SRP + Deterministic-first (con pocos datos se usan umbrales, no un modelo).
[Paradigma]: Funcional (sin estado entre llamadas).
"""

import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from src.modules.analytics.domain.entities.difficulty_label import (
    Anomaly,
    Difficulty,
    DifficultyLabel,
    QuestionStats,
)

_LEVELS: tuple[Difficulty, ...] = ("easy", "medium", "hard")
MIN_FOR_MODEL = 6  # Menos preguntas → KMeans no es fiable; se usan umbrales fijos


def _by_threshold(error_rate: float) -> Difficulty:
    """Respaldo determinista: < 30 % de error = fácil, < 60 % = media, resto = difícil."""
    return "easy" if error_rate < 0.3 else "medium" if error_rate < 0.6 else "hard"


def classify(stats: list[QuestionStats]) -> list[DifficultyLabel]:
    """Agrupa por tasa de error y tiempo en 3 grupos; el grupo con menos error es «fácil»."""
    if not stats:
        return []
    if len(stats) < MIN_FOR_MODEL:
        return [
            DifficultyLabel(
                s.question_id,
                s.original,
                _by_threshold(s.error_rate),
                0.5,
                s.attempts,
                s.error_rate,
            )
            for s in stats
        ]
    x = StandardScaler().fit_transform(
        np.array([[s.error_rate, s.avg_time_ms] for s in stats])
    )
    km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(
        x
    )  # `random_state`: mismo resultado en cada ejecución
    # [Orden de grupos]: por tasa de error media (columna 0 del centroide) → 0 = fácil, 2 = difícil
    order = np.argsort(km.cluster_centers_[:, 0])
    level_of = {int(cluster): _LEVELS[rank] for rank, cluster in enumerate(order)}
    dist = km.transform(x)  # Distancia de cada pregunta a cada centroide
    labels = []
    for i, s in enumerate(stats):
        c = int(km.labels_[i])
        # [Confianza]: 1 − distancia relativa al propio centro (cerca del centro = etiqueta segura)
        conf = float(1 - dist[i, c] / (dist[i].sum() or 1))
        labels.append(
            DifficultyLabel(
                s.question_id,
                s.original,
                level_of[c],
                round(conf, 3),
                s.attempts,
                s.error_rate,
            )
        )
    return labels


def detect(stats: list[QuestionStats], contamination: float = 0.1) -> list[Anomaly]:
    """Preguntas con patrón atípico (p. ej. muy rápidas y casi siempre falladas → enunciado o clave dudosos)."""
    if len(stats) < MIN_FOR_MODEL:
        return []  # Con pocos datos no se afirma que algo sea atípico (la especificación prohíbe inventar)
    x = np.array([[s.error_rate, s.avg_time_ms, s.attempts] for s in stats])
    model = IsolationForest(contamination=contamination, random_state=0).fit(x)
    scores = model.decision_function(x)
    flags = model.predict(x)  # -1 = atípica
    mean_err = float(np.mean(x[:, 0]))
    mean_time = float(np.mean(x[:, 1]))
    out = []
    for s, score, flag in zip(stats, scores, flags, strict=True):
        if flag == -1:
            reasons = []
            if s.error_rate > mean_err:
                reasons.append("falla mucho más que el resto")
            if s.avg_time_ms < mean_time * 0.5:
                reasons.append("se responde demasiado rápido")
            elif s.avg_time_ms > mean_time * 1.5:
                reasons.append("tarda mucho más que el resto")
            out.append(
                Anomaly(
                    s.question_id,
                    round(float(score), 4),
                    s.error_rate,
                    s.avg_time_ms,
                    "; ".join(reasons) or "patrón de respuesta atípico",
                )
            )
    return sorted(out, key=lambda a: a.score)  # Las más atípicas primero
