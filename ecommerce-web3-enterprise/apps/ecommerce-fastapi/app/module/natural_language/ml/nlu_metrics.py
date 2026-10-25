# nlu_metrics.py (Python estándar) => RF-17.12 precisión de la detección de intenciones y de
# entidades sobre ejemplos REALES etiquetados (RF-17.13).
# Intenciones: partición determinista (1 de cada 5 ejemplos a prueba) => el clasificador se arma con
# los ejemplos base + el 80 % aprendido y se mide con el 20 % que NO vio (sin fuga de datos).
# Entidades: precisión / exhaustividad (recall) / F1 comparando (etiqueta, texto) esperados vs
# extraídos. Patrón: Strategy (clasificador y extractor se inyectan como funciones: testeable sin
# modelos). Paradigma: funcional (funciones puras).

from collections import Counter
from collections.abc import Callable
from typing import Any

Classify = Callable[[str], tuple[str, float]]
Extract = Callable[[str], list[dict[str, Any]]]


# split => (entrenamiento, prueba) estable: el mismo ejemplo cae siempre del mismo lado
def split(examples: list[dict[str, Any]], every: int = 5) -> tuple[list[dict], list[dict]]:
    test = [e for i, e in enumerate(examples) if i % every == every - 1]
    train = [e for i, e in enumerate(examples) if i % every != every - 1]
    return train, test


# intent_metrics => exactitud global + precisión/recall por intención
def intent_metrics(test: list[dict[str, Any]], classify: Classify) -> dict[str, Any]:
    if not test:
        return {"samples": 0, "accuracy": None, "per_intent": {}}
    hits: Counter[str] = Counter()
    predicted: Counter[str] = Counter()
    actual: Counter[str] = Counter()
    for example in test:
        label, _ = classify(example["text"])
        predicted[label] += 1
        actual[example["intent"]] += 1
        if label == example["intent"]:
            hits[label] += 1
    per_intent = {
        intent: {
            "precision": round(hits[intent] / predicted[intent], 3) if predicted[intent] else None,
            "recall": round(hits[intent] / actual[intent], 3),
            "support": actual[intent],
        }
        for intent in actual
    }
    accuracy = round(sum(hits.values()) / len(test), 3)
    return {"samples": len(test), "accuracy": accuracy, "per_intent": per_intent}


# entity_metrics => micro-promedio sobre todos los ejemplos que traen entidades esperadas
def entity_metrics(examples: list[dict[str, Any]], extract: Extract) -> dict[str, Any]:
    labeled = [e for e in examples if e.get("entities")]
    expected_total = found_total = matched = 0
    for example in labeled:
        expected = {(x["label"], x["text"].lower()) for x in example["entities"]}
        found = {(x["label"], x["text"].lower()) for x in extract(example["text"])}
        expected_total += len(expected)
        found_total += len(found)
        matched += len(expected & found)
    precision = matched / found_total if found_total else None
    recall = matched / expected_total if expected_total else None
    f1 = round(2 * precision * recall / (precision + recall), 3) if precision and recall else None
    return {
        "samples": len(labeled),
        "precision": round(precision, 3) if precision is not None else None,
        "recall": round(recall, 3) if recall is not None else None,
        "f1": f1,
    }
