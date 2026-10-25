# test_nlp.py (pytest) => 5.3: clasificador por prototipos, NER por reglas, limpieza de correos y
# agregado de sentimiento. Codificador falso (bolsa de palabras): sin Ollama ni TensorFlow.

import numpy as np
import pandas as pd

from app.module.email_parser.ml import ner_extractor
from app.module.email_parser.ml.email_preprocessor import preprocess
from app.module.natural_language.ml.intent_detector import PrototypeClassifier
from app.module.sentiment_analysis.ml.sentiment_aggregator import aggregate

VOCAB = ["excelente", "encantó", "roto", "pésimo", "pedido", "llega"]


def fake_encoder(texts: list[str]) -> np.ndarray:
    vectors = (
        np.array([[t.lower().count(w) for w in VOCAB] for t in texts], dtype=np.float32) + 0.01
    )
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def test_prototype_classifier_picks_closest_centroid() -> None:
    classifier = PrototypeClassifier(
        {"positive": ["excelente", "me encantó"], "negative": ["llegó roto", "pésimo"]},
        fake_encoder,
    )
    label, score = classifier.classify("producto excelente, me encantó")
    assert label == "positive" and 0.5 < score <= 1
    assert classifier.classify("todo roto, pésimo")[0] == "negative"


def test_ner_extracts_ecommerce_entities() -> None:
    text = (
        "Mi pedido ORD-20260929-4F2A no llega. Pagué $ 120.000 COP el 29/09/2026, "
        "tel 3001234567, ana@x.co"
    )
    labels = {(e["label"], e["text"]) for e in ner_extractor.extract(text)}
    assert ("ORDER_NUMBER", "ORD-20260929-4F2A") in labels
    assert ("MONEY", "$ 120.000 COP") in labels
    assert {("DATE", "29/09/2026"), ("PHONE", "3001234567"), ("EMAIL", "ana@x.co")} <= labels


def test_preprocess_raw_html_email() -> None:
    raw = (
        "From: Ana <ana@x.co>\nSubject: Reembolso\nContent-Type: text/html\n\n"
        "<style>p{}</style><p>Quiero   el <b>reembolso</b></p>"
    )
    email = preprocess(raw)
    assert (email.subject, email.sender, email.text) == (
        "Reembolso",
        "ana@x.co",
        "Quiero el reembolso",
    )


def test_sentiment_aggregate_net_score() -> None:
    frame = pd.DataFrame(
        {"label": ["positive", "positive", "negative", "neutral"], "score": [0.9, 0.8, 0.7, 0.6]}
    )
    result = aggregate(frame)
    assert result["total"] == 4 and result["net_sentiment"] == 0.25
    assert aggregate(frame.iloc[0:0])["total"] == 0
