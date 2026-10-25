# social_insights.py (Python puro) => RF-15.11 sentimiento de comentarios y publicaciones de redes
# sociales + conclusiones sobre las CAUSAS del sentimiento negativo. RF-15.10 emociones (felicidad,
# frustración, sorpresa y decepción). Léxico es/en sin modelo (rápido, offline y explicable: cada
# causa trae ejemplos reales). Patrón: Pipeline (normalizar -> puntuar -> agrupar causas ->
# concluir) + Data-Driven (léxicos y causas son datos).
# Paradigma: funcional (funciones puras: textos -> métricas).

import re
import unicodedata
from collections import Counter
from typing import Any

POSITIVE = {
    "excelente",
    "perfecto",
    "encanta",
    "genial",
    "bueno",
    "buena",
    "recomiendo",
    "rapido",
    "hermoso",
    "feliz",
    "gracias",
    "love",
    "great",
    "good",
    "amazing",
    "calidad",
    "lindo",
    "linda",
    "super",
}
NEGATIVE = {
    "malo",
    "mala",
    "pesimo",
    "horrible",
    "terrible",
    "defectuoso",
    "roto",
    "tarde",
    "estafa",
    "nunca",
    "devolver",
    "decepcion",
    "falso",
    "caro",
    "demora",
    "bad",
    "awful",
    "worst",
    "broken",
    "scam",
    "late",
}
NEGATIONS = {"no", "nunca", "jamas", "not", "never"}
EMOTIONS: dict[str, set[str]] = {
    "happiness": {
        "feliz",
        "encanta",
        "excelente",
        "perfecto",
        "genial",
        "contento",
        "love",
        "happy",
        "amazing",
    },
    "frustration": {
        "frustrado",
        "molesto",
        "enojado",
        "nunca",
        "tarde",
        "demora",
        "pesimo",
        "angry",
        "late",
    },
    "surprise": {
        "sorpresa",
        "sorprendido",
        "inesperado",
        "increible",
        "wow",
        "surprised",
        "unexpected",
    },
    "disappointment": {
        "decepcion",
        "decepcionado",
        "esperaba",
        "lastima",
        "malo",
        "disappointed",
        "meh",
    },
}
# CAUSES => temas a los que se atribuye un comentario negativo (palabra clave -> causa)
CAUSES: dict[str, set[str]] = {
    "entrega": {
        "envio",
        "entrega",
        "llego",
        "tarde",
        "demora",
        "transportadora",
        "delivery",
        "shipping",
        "late",
    },
    "calidad": {
        "calidad",
        "roto",
        "defectuoso",
        "danado",
        "mala",
        "malo",
        "falso",
        "quality",
        "broken",
    },
    "talla": {"talla", "grande", "pequeno", "pequena", "ajuste", "size", "small", "big"},
    "precio": {"caro", "precio", "costoso", "cobro", "expensive", "price"},
    "atencion": {"atencion", "servicio", "responden", "soporte", "nadie", "support", "service"},
    "pago": {"pago", "tarjeta", "cobraron", "reembolso", "payment", "refund"},
}
CAUSE_LABELS = {
    "entrega": "demoras o problemas en la entrega",
    "calidad": "calidad del producto",
    "talla": "tallas y ajuste",
    "precio": "precio percibido como alto",
    "atencion": "atención al cliente",
    "pago": "pagos y reembolsos",
}
MIXED_RATIO = 0.3


def _words(text: str) -> list[str]:
    plain = unicodedata.normalize("NFD", text.lower())
    plain = "".join(char for char in plain if unicodedata.category(char) != "Mn")  # Quita tildes
    return re.findall(r"[a-zñ]+", plain)


# analyze_text => {label, score, emotions} de UN texto (negación en una ventana de 2 palabras)
def analyze_text(text: str) -> dict[str, Any]:
    words = _words(text)
    positive = negative = 0
    for index, word in enumerate(words):
        polarity = 1 if word in POSITIVE else -1 if word in NEGATIVE else 0
        if polarity == 0:
            continue
        if any(previous in NEGATIONS for previous in words[max(0, index - 2) : index]):
            polarity = -polarity
        positive += polarity > 0
        negative += polarity < 0
    hits = positive + negative
    score = 0.0 if hits == 0 else round((positive - negative) / hits, 3)
    mixed = hits > 1 and min(positive, negative) / hits >= MIXED_RATIO
    label = (
        "mixed"
        if mixed
        else "positive"
        if score > 0.15
        else "negative"
        if score < -0.15
        else "neutral"
    )
    counts = {
        emotion: sum(word in lexicon for word in words) for emotion, lexicon in EMOTIONS.items()
    }
    top = max(1, *counts.values())
    return {
        "label": label,
        "score": score,
        "emotions": {k: round(v / top, 2) for k, v in counts.items()},
    }


# insights => análisis por texto + resumen + causas de lo negativo con ejemplos + conclusión legible
def insights(texts: list[dict[str, str]]) -> dict[str, Any]:
    items = [{"id": item["id"], **analyze_text(item["text"])} for item in texts]
    counts = Counter(item["label"] for item in items)
    negatives = [
        text
        for text, item in zip(texts, items, strict=True)
        if item["label"] in ("negative", "mixed")
    ]
    causes: Counter[str] = Counter()
    examples: dict[str, list[str]] = {}
    for text in negatives:
        words = set(_words(text["text"]))
        for cause, keywords in CAUSES.items():
            if words & keywords:
                causes[cause] += 1
                examples.setdefault(cause, []).append(text["text"][:140])
    total = len(items) or 1
    top_causes = [
        {
            "cause": cause,
            "label": CAUSE_LABELS[cause],
            "count": count,
            "share": round(count / max(1, len(negatives)), 3),
            "examples": examples[cause][:3],
        }
        for cause, count in causes.most_common(5)
    ]
    negative_share = (counts["negative"] + counts["mixed"]) / total
    if not negatives:
        conclusion = "No hay sentimiento negativo relevante en el período."
    elif top_causes:
        main = top_causes[0]
        conclusion = (
            f"El {round(negative_share * 100)} % de los comentarios es negativo o mixto. "
            f"La causa principal es {main['label']} ({main['count']} menciones); "
            "conviene priorizarla."
        )
    else:
        share = round(negative_share * 100)
        conclusion = f"El {share} % de los comentarios es negativo, sin una causa dominante."
    return {
        "items": items,
        "summary": {
            "total": len(items),
            "counts": dict(counts),
            "net_sentiment": round((counts["positive"] - counts["negative"]) / total, 3),
        },
        "negative_causes": top_causes,
        "conclusion": conclusion,
    }
