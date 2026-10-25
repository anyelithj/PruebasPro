# bert_sentiment.py (embeddings multilingües: BERT de KerasHub u Ollama) => sentimiento
# positivo / neutral / negativo de reseñas y comentarios en español o inglés.
# Patrón: Strategy (el codificador lo elige TEXT_ENCODER) + Singleton (un clasificador por proceso).
# Paradigma: funcional. Reutiliza PrototypeClassifier (DRY): sin reentrenar ni etiquetar datos.

from functools import lru_cache

from app.module.natural_language.ml.intent_detector import PrototypeClassifier
from app.module.sentiment_analysis.ml.multilingual_model import get_encoder

SENTIMENT_EXAMPLES: dict[str, list[str]] = {
    "positive": [
        "excelente producto, me encantó",
        "llegó rápido y la calidad es muy buena",
        "lo recomiendo totalmente",
        "súper cómodo, volvería a comprar",
        "muy contento con mi compra",
        "great quality, I love it",
        "fast delivery, very happy",
    ],
    "neutral": [
        "el producto es normal, cumple",
        "llegó el pedido",
        "es lo que dice la descripción",
        "está bien, nada especial",
        "ni bueno ni malo",
        "it is okay, nothing special",
        "average product",
    ],
    "negative": [
        "pésima calidad, no lo recomiendo",
        "llegó roto y tarde",
        "quiero mi dinero de vuelta",
        "no funciona, perdí mi dinero",
        "muy decepcionado con la compra",
        "terrible, broke after one day",
        "very disappointed with this purchase",
    ],
}


@lru_cache(maxsize=1)
def sentiment_classifier() -> PrototypeClassifier:
    return PrototypeClassifier(SENTIMENT_EXAMPLES, get_encoder())
