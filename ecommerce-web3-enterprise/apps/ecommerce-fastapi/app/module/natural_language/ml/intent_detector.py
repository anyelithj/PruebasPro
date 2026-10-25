# intent_detector.py (embeddings multilingües + NumPy) => detección de intención del chatbot.
# PrototypeClassifier: clasificación "few-shot" por prototipos — cada clase es el promedio
# (centroide) de los embeddings de unos ejemplos; un texto pertenece a la clase cuyo centroide es
# más parecido. Sin entrenamiento ni datos etiquetados (ahorro de cómputo); agregar una intención =
# agregar ejemplos. Lo reutilizan sentiment_analysis (bert_sentiment) y email_parser
# (intent_classifier) (DRY).
# Patrón: Strategy (el codificador se inyecta: DIP) + Lazy Initialization (centroides al primer
# uso). Paradigma: funcional + Data-Driven (las clases son datos: dict etiqueta -> ejemplos).

from functools import lru_cache

import numpy as np

from app.module.sentiment_analysis.ml.multilingual_model import Encoder, get_encoder


class PrototypeClassifier:
    def __init__(self, examples: dict[str, list[str]], encoder: Encoder) -> None:
        self.labels = list(examples)
        self.examples = examples
        self.encoder = encoder
        self._centroids: np.ndarray | None = None  # Se calculan una sola vez (1 llamada por lote)

    def centroids(self) -> np.ndarray:
        if self._centroids is None:
            rows = [self.encoder(texts).mean(axis=0) for texts in self.examples.values()]
            matrix = np.vstack(rows)  # (n_clases, dim)
            self._centroids = matrix / np.linalg.norm(matrix, axis=1, keepdims=True)
        return self._centroids

    # classify => (etiqueta, confianza 0-1). Softmax de las similitudes con "temperatura" 0.05: las
    # diferencias de coseno son pequeñas y así se convierten en probabilidades legibles
    def classify(self, text: str) -> tuple[str, float]:
        similarities = self.centroids() @ self.encoder([text])[0]  # "@" => producto matricial
        weights = np.exp((similarities - similarities.max()) / 0.05)
        probabilities = weights / weights.sum()
        best = int(probabilities.argmax())
        return self.labels[best], round(float(probabilities[best]), 4)


# Intenciones del chatbot de la tienda (español e inglés: el codificador es multilingüe)
CHAT_INTENTS: dict[str, list[str]] = {
    "greeting": ["hola", "buenos días", "buenas tardes", "hello", "hi there", "gracias", "thanks"],
    "order_status": [
        "dónde está mi pedido",
        "estado de mi orden",
        "cuándo llega mi compra",
        "no me ha llegado el paquete",
        "where is my order",
        "track my package",
    ],
    "product_search": [
        "busco unos tenis",
        "tienen camisetas negras",
        "quiero comprar un reloj",
        "do you have red shoes",
        "I am looking for a jacket",
    ],
    "recommendation": [
        "qué me recomiendas",
        "sugiéreme un regalo",
        "qué producto es mejor",
        "what do you recommend",
        "suggest something",
    ],
    "returns": [
        "quiero devolver un producto",
        "cómo hago un reembolso",
        "llegó dañado",
        "I want a refund",
        "return my order",
    ],
    "human": [
        "quiero hablar con una persona",
        "comunícame con un asesor",
        "talk to a human",
        "contact support agent",
    ],
}


# merge_examples => base + ejemplos aprendidos de conversaciones reales (RF-17.13). Función pura:
# una intención nueva etiquetada por un agente también se agrega como clase.
def merge_examples(
    base: dict[str, list[str]], learned: dict[str, list[str]]
) -> dict[str, list[str]]:
    merged = {label: list(texts) for label, texts in base.items()}
    for label, texts in learned.items():
        merged.setdefault(label, []).extend(t for t in texts if t not in merged[label])
    return merged


# _learned => ejemplos aprobados cargados de la base (los fija set_learned_examples)
_learned: dict[str, list[str]] = {}


@lru_cache(maxsize=1)
def chat_intent_classifier() -> PrototypeClassifier:
    return PrototypeClassifier(merge_examples(CHAT_INTENTS, _learned), get_encoder())


# set_learned_examples => reentrenamiento continuo: reemplaza los aprendidos y descarta la caché
# (los centroides se recalculan en el próximo uso; "entrenar" = promediar embeddings: segundos)
def set_learned_examples(learned: dict[str, list[str]]) -> None:
    _learned.clear()
    _learned.update(learned)
    chat_intent_classifier.cache_clear()
