# intent_classifier.py (embeddings multilingües) => intención de un correo de cliente para enrutarlo
# al equipo correcto. Reutiliza PrototypeClassifier (DRY): solo cambian las clases y sus ejemplos.
# Patrón: Strategy + Singleton. Paradigma: Data-Driven.

from functools import lru_cache

from app.module.natural_language.ml.intent_detector import PrototypeClassifier
from app.module.sentiment_analysis.ml.multilingual_model import get_encoder

EMAIL_INTENTS: dict[str, list[str]] = {
    "order_status": [
        "mi pedido no ha llegado",
        "quiero saber el estado de mi orden",
        "where is my order",
    ],
    "refund": ["solicito el reembolso de mi compra", "devuélvanme el dinero", "I want a refund"],
    "complaint": [
        "estoy muy molesto con el servicio",
        "el producto llegó dañado",
        "this is unacceptable",
    ],
    "shipping": [
        "quiero cambiar la dirección de envío",
        "cuánto cuesta el envío",
        "shipping address change",
    ],
    "product_question": [
        "el producto viene en otro color",
        "qué talla me recomiendan",
        "is this item waterproof",
    ],
    "invoice": [
        "necesito la factura de mi compra",
        "envíenme la factura electrónica",
        "please send the invoice",
    ],
}


@lru_cache(maxsize=1)
def email_intent_classifier() -> PrototypeClassifier:
    return PrototypeClassifier(EMAIL_INTENTS, get_encoder())
