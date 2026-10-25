# llm_evaluator.py (MLflow + Python) => evaluación del asistente (Plan 5B.5): ejecuta un set de
# preguntas de prueba (es/en) con el mismo pipeline del chat (RAG + prompt + proveedor) y mide
# fidelidad al contexto, alucinación, palabras clave esperadas, latencia y costo (tokens estimados;
# 0 USD con Ollama local). El service registra el resumen en MLflow.
# Patrón: Strategy (el proveedor a evaluar se inyecta: económico vs potente) + Template Method
# (misma secuencia por pregunta). Paradigma: funcional (métricas puras) + asíncrono.
# Ahorro de recursos: set pequeño (8 preguntas), sin herramientas ni caché y en el worker de Celery.

import re
import time
from collections.abc import Awaitable, Callable
from typing import Any

from app.module.llm_assistant.ml.llm_provider import LlmProvider
from app.module.llm_assistant.ml.prompt_builder import build_prompt
from app.module.llm_assistant.ml.rag_retriever import Source

HALLUCINATION_THRESHOLD = 0.5  # Fidelidad por debajo => la respuesta no se apoya en el contexto
CHARS_PER_TOKEN = 4  # Aproximación estándar para estimar tokens sin el tokenizador del modelo

# Preguntas con respuesta en la FAQ/políticas indexadas (knowledge_indexer.py) y los datos que la
# respuesta correcta debe mencionar
EVAL_SET: list[dict[str, Any]] = [
    {"question": "¿Cuánto tarda un envío a una ciudad principal?", "lang": "es", "keywords": ["3"]},
    {"question": "¿Desde qué monto el envío es gratis?", "lang": "es", "keywords": ["150"]},
    {
        "question": "¿Cuántos días tengo para devolver un producto?",
        "lang": "es",
        "keywords": ["30"],
    },
    {"question": "¿Qué garantía tienen los productos?", "lang": "es", "keywords": ["1"]},
    {"question": "¿Me pueden pedir mi frase semilla?", "lang": "es", "keywords": ["nunca"]},
    {"question": "How long do I have to return an item?", "lang": "en", "keywords": ["30"]},
    {"question": "Which payment methods do you accept?", "lang": "en", "keywords": ["stripe"]},
    {"question": "What does SHIPPED status mean?", "lang": "en", "keywords": ["tracking"]},
]

WORD = re.compile(r"\w{4,}|\d+")  # Palabras de 4+ letras y números (descarta artículos)


def _terms(text: str) -> set[str]:
    return set(WORD.findall(text.lower()))


# faithfulness => fracción de términos de la respuesta presentes en el contexto recuperado
# ponytail: heurística léxica (sin otro LLM como juez); un juez LLM mediría mejor paráfrasis, a
# costa de duplicar el cómputo de cada evaluación
def faithfulness(answer: str, context: str) -> float:
    terms = _terms(answer)
    return 1.0 if not terms else len(terms & _terms(context)) / len(terms)


def keyword_recall(answer: str, keywords: list[str]) -> float:
    text = answer.lower()
    return sum(k.lower() in text for k in keywords) / len(keywords) if keywords else 1.0


def p95(values: list[int]) -> int:
    ordered = sorted(values)
    return ordered[max(0, round(0.95 * len(ordered)) - 1)] if ordered else 0  # Nearest-rank


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(results) or 1
    latencies = [r["latency_ms"] for r in results]
    return {
        "questions": len(results),
        "faithfulness": round(sum(r["faithfulness"] for r in results) / n, 4),
        "hallucination_rate": round(sum(r["hallucinated"] for r in results) / n, 4),
        "keyword_recall": round(sum(r["keyword_recall"] for r in results) / n, 4),
        "avg_latency_ms": int(sum(latencies) / n),
        "p95_latency_ms": p95(latencies),
        "est_tokens": sum(r["est_tokens"] for r in results),
    }


# evaluate => corre el set completo; "retrieve" se inyecta (pgvector en producción, falso en tests)
async def evaluate(
    provider: LlmProvider,
    retrieve: Callable[[str, str], Awaitable[list[Source]]],
    items: list[dict[str, Any]] = EVAL_SET,
) -> list[dict[str, Any]]:
    results = []
    for item in items:
        sources = await retrieve(item["question"], item["lang"])
        prompt = build_prompt([], item["question"], sources)
        started = time.perf_counter()
        answer = "".join([part async for part in provider.stream(prompt) if isinstance(part, str)])
        context = " ".join(s.content for s in sources)
        score = faithfulness(answer, context)
        prompt_chars = sum(len(m["content"]) for m in prompt)
        results.append(
            {
                "question": item["question"],
                "lang": item["lang"],
                "answer": answer[:300],
                "faithfulness": round(score, 4),
                "hallucinated": score < HALLUCINATION_THRESHOLD,
                "keyword_recall": keyword_recall(answer, item["keywords"]),
                "latency_ms": int((time.perf_counter() - started) * 1000),
                "est_tokens": (prompt_chars + len(answer)) // CHARS_PER_TOKEN,
            }
        )
    return results
