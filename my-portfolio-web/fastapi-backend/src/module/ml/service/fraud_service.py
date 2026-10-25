"""[SRP][ML] Detección de fraude/anomalía en wallets con IsolationForest (scikit-learn).

Analiza SOLO la forma de la dirección (sin llamadas on-chain) para bloquear bots,
spam o direcciones artificiales antes de permitir el uso del agente IA.
El modelo se entrena una vez al arrancar sobre direcciones sintéticas "normales"
(Ethereum + Solana) y puntúa cada dirección entrante como anomalía o no.
"""

from __future__ import annotations

import math
import re
from collections import Counter

import numpy as np
from sklearn.ensemble import IsolationForest

# Formatos válidos: Ethereum (0x + 40 hex) y Solana (Base58, 32–44).
_ETH_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_SOL_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")

_HEX = "0123456789abcdef"
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    counts = Counter(s)
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def _features(address: str) -> list[float]:
    """Vector de características de la dirección (forma, entropía, repetición…)."""
    a = address.strip()
    length = len(a)
    if length == 0:
        return [0.0, 0.0, 0.0, 1.0, 0.0, 0.0]
    entropy = _shannon_entropy(a)
    digit_ratio = sum(ch.isdigit() for ch in a) / length
    max_run = run = 1
    for i in range(1, length):
        if a[i] == a[i - 1]:
            run += 1
            max_run = max(max_run, run)
        else:
            run = 1
    repeat_ratio = max_run / length
    valid = 1.0 if (_ETH_RE.match(a) or _SOL_RE.match(a)) else 0.0
    unique_ratio = len(set(a)) / length
    return [float(length), entropy, digit_ratio, repeat_ratio, valid, unique_ratio]


def _synthetic_normal(n: int = 500) -> np.ndarray:
    """Genera direcciones válidas realistas para entrenar el detector de anomalías."""
    rng = np.random.default_rng(42)
    hexchars = list(_HEX)
    b58 = list(_B58)
    rows: list[list[float]] = []
    for _ in range(n):
        if rng.random() < 0.5:
            addr = "0x" + "".join(rng.choice(hexchars, 40))
        else:
            length = int(rng.integers(32, 45))
            addr = "".join(rng.choice(b58, length))
        rows.append(_features(addr))
    return np.asarray(rows, dtype=float)


class WalletFraudService:
    """[STRATEGY] Servicio de scoring de fraude. Se instancia una vez (modelo entrenado)."""

    def __init__(self) -> None:
        features = _synthetic_normal()
        self._model = IsolationForest(
            n_estimators=150, contamination=0.05, random_state=42
        )
        self._model.fit(features)
        # Distribución de scores de entrenamiento → umbrales por percentil (auto-calibra).
        self._train_scores = np.sort(self._model.score_samples(features))
        self._p05 = float(np.percentile(self._train_scores, 5))
        self._p25 = float(np.percentile(self._train_scores, 25))

    def _risk_percent(self, score: float) -> int:
        # % de wallets normales con score >= al de entrada → cuanto menor score, mayor riesgo.
        frac_below = float(np.mean(self._train_scores <= score))
        return int(round((1.0 - frac_below) * 100))

    def analyze(self, address: str, chain: str | None = None) -> dict[str, object]:
        feats = _features(address)
        matrix = np.asarray([feats], dtype=float)
        # score_samples: mayor = más normal; predict: 1 normal / -1 anomalía.
        score = float(self._model.score_samples(matrix)[0])
        valid = bool(feats[4])
        anomalous = score < self._p05  # 5% más raro respecto a wallets normales

        # Señales heurísticas fuertes (bloquean incluso si el formato es válido).
        reasons: list[str] = []
        red_flag = False
        if not valid:
            reasons.append("Formato de dirección inválido para la red")
            red_flag = True
        if feats[3] > 0.4:
            reasons.append("Demasiados caracteres repetidos (patrón artificial)")
            red_flag = True
        if feats[1] < 3.0:
            reasons.append("Entropía baja: parece generada, no una wallet real")
            red_flag = True
        if anomalous and valid and not red_flag:
            reasons.append("Patrón inusual detectado por el modelo (revisión recomendada)")

        # Formato inválido / red flags → bloqueo. Anomalía sola → aviso, no bloqueo.
        is_suspicious = red_flag
        if red_flag:
            risk_level = "high"
        elif anomalous:
            risk_level = "medium"
        else:
            risk_level = "low"

        risk_percent = 100 if red_flag else self._risk_percent(score)

        return {
            "address": address,
            "chain": chain,
            "valid_format": valid,
            "is_suspicious": is_suspicious,
            "risk_level": risk_level,
            "risk_percent": risk_percent,
            "anomaly_score": round(score, 4),
            "reasons": reasons,
            "allowed": not is_suspicious,
        }
