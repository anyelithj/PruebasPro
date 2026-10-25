# ner_extractor.py (spaCy) => reconocimiento de entidades (NER) en correos y mensajes de clientes.
# Pipeline spaCy "blank" (tokenizador multilingüe) + EntityRuler (reglas): detecta lo que importa en
# soporte de e-commerce — número de pedido, email, teléfono, monto, fecha — sin descargar un modelo
# estadístico (0 MB extra, microsegundos por texto). Si está instalado es_core_news_sm, se suman las
# entidades estadísticas PER/ORG/LOC (Strategy por disponibilidad).
# Lo reutiliza natural_language (POST /nlp/intent) (DRY).
# Patrón: Pipeline (tokenizar -> reglas -> [modelo]) + Singleton perezoso. Paradigma: declarativo
# (las entidades se describen como patrones de datos).

from functools import lru_cache
from typing import Any

import spacy
from spacy.language import Language

NUMBER = r"^\d{1,3}([.,]\d{3})*([.,]\d{1,2})?$"  # 120.000 | 1,250.50 | 45
CURRENCIES = ["cop", "usd", "eur", "pesos", "dólares", "dolares"]

PATTERNS: list[dict[str, Any]] = [
    {"label": "ORDER_NUMBER", "pattern": [{"TEXT": {"REGEX": r"^ORD-\d{8}-[A-Z0-9]{4}$"}}]},
    {"label": "EMAIL", "pattern": [{"LIKE_EMAIL": True}]},
    {"label": "PHONE", "pattern": [{"TEXT": {"REGEX": r"^\+?\d{7,13}$"}}]},
    {"label": "DATE", "pattern": [{"TEXT": {"REGEX": r"^\d{1,2}/\d{1,2}/\d{2,4}$"}}]},
    {"label": "DATE", "pattern": [{"TEXT": {"REGEX": r"^\d{4}-\d{2}-\d{2}$"}}]},
    # Monto: "$ 120.000 [COP]" o "120.000 COP" (un número suelto no es dinero: evita falsos
    # positivos)
    {
        "label": "MONEY",
        "pattern": [
            {"TEXT": "$"},
            {"TEXT": {"REGEX": NUMBER}},
            {"LOWER": {"IN": CURRENCIES}, "OP": "?"},
        ],
    },
    {"label": "MONEY", "pattern": [{"TEXT": {"REGEX": NUMBER}}, {"LOWER": {"IN": CURRENCIES}}]},
]


@lru_cache(maxsize=1)
def _pipeline() -> Language:
    try:
        nlp = spacy.load("es_core_news_sm", exclude=["parser", "lemmatizer"])  # Opcional
        ruler = nlp.add_pipe("entity_ruler", before="ner")  # Las reglas tienen prioridad
    except OSError:  # Modelo no instalado => solo reglas
        nlp = spacy.blank("es")
        ruler = nlp.add_pipe("entity_ruler")
    ruler.add_patterns(PATTERNS)
    return nlp


# extract => [{"label", "text", "start", "end"}] (start/end = posición en caracteres)
def extract(text: str) -> list[dict[str, Any]]:
    return [
        {"label": e.label_, "text": e.text, "start": e.start_char, "end": e.end_char}
        for e in _pipeline()(text).ents
    ]
