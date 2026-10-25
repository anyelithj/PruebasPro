"""Evaluación de calidad del LLM propio con el conjunto reservado (Sprint 5.6 · RF-144).

Mide por modelo: JSON válido, coincidencia exacta y similitud del texto corregido con la referencia, y latencia p95.
Compara aula-corrector con su modelo base y con los demás modelos locales (Aya, Qwen y Mistral si están en Ollama).
Umbrales (gates) para publicar: JSON válido ≥ 98 %, mejora frente al modelo base, latencia p95 ≤ RNF-03 y,
si se pasan las notas de los docentes, media ≥ 4/5. Escribe la ficha del modelo que sirve GET /own-llm/model.

Uso (desde apps/ai-service):
    python -m tests.evaluation.run_eval [--compare qwen2.5:3b mistral] [--teacher-scores notas.json]
Código de salida 1 si algún umbral no se cumple (sirve como paso de CI antes de cambiar de modelo o de prompt).

[Patrón]: Test Harness + Strategy (cada modelo se evalúa con la misma estrategia y un solo eslabón).
[Principio]: DRY — usa WritingCorrectorModel tal cual lo sirve el servicio; SRP — métricas en funciones puras.
[Paradigma]: Funcional (métricas) + asíncrono (inferencia).
"""

import argparse
import asyncio
import json
import statistics  # stdlib: media y cuantiles
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from difflib import SequenceMatcher  # stdlib: similitud de cadenas (sin dependencias)
from pathlib import Path
from time import perf_counter

HELDOUT = Path("data/own_llm/heldout.jsonl")
EXPORT_INFO = Path("data/own_llm/export.txt")
RNF03_P95_MS = 5000  # RNF-03: respuesta interactiva de IA en ≤ 5 s (p95)
MIN_JSON_VALID = 0.98
MIN_TEACHER_SCORE = 4.0


@dataclass(frozen=True)
class Sample:
    """Resultado de un ejemplo: ¿JSON válido?, similitud 0..1, ¿exacto? y latencia."""

    valid: bool
    similarity: float
    exact: bool
    latency_ms: float


def _norm(s: str) -> str:
    return " ".join(s.split()).lower()


def score_sample(predicted: str | None, reference: str, latency_ms: float) -> Sample:
    """Puntúa una predicción (None = el modelo no devolvió JSON válido) | [Paradigma]: Funcional (pura)."""
    if predicted is None:
        return Sample(False, 0.0, False, latency_ms)
    return Sample(True, SequenceMatcher(None, _norm(predicted), _norm(reference)).ratio(), _norm(predicted) == _norm(reference), latency_ms)


def summarize(samples: list[Sample]) -> dict[str, float]:
    latencies = sorted(s.latency_ms for s in samples)
    return {
        "json_valid": sum(s.valid for s in samples) / len(samples),
        "exact_match": sum(s.exact for s in samples) / len(samples),
        "similarity": statistics.fmean(s.similarity for s in samples),
        "p95_ms": latencies[min(len(latencies) - 1, int(0.95 * len(latencies)))],  # Cuantil 95 por rango más cercano
    }


def gates(own: dict[str, float], base: dict[str, float] | None, teacher: float | None) -> dict[str, bool]:
    result = {
        "json_valid_ge_98": own["json_valid"] >= MIN_JSON_VALID,
        "p95_le_rnf03": own["p95_ms"] <= RNF03_P95_MS,
        "better_than_base": base is None or own["similarity"] > base["similarity"],
    }
    if teacher is not None:
        result["teacher_score_ge_4"] = teacher >= MIN_TEACHER_SCORE
    return result


async def evaluate(model: str, rows: list[dict]) -> dict[str, float]:
    from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
    from src.modules.own_llm.infrastructure.models.writing_corrector_model import WritingCorrectorModel
    from src.shared.config.settings import get_settings
    from src.shared.exceptions.custom_errors import ModelInferenceError

    corrector = WritingCorrectorModel(OllamaClient(timeout=get_settings().own_llm_timeout_s), (model,))  # Un solo eslabón: sin respaldo
    samples = []
    for row in rows:
        ref = row["reference"]
        started = perf_counter()
        try:
            draft, _ = await corrector.correct(ref["text"], ref["language"], ref["level"])
            predicted = draft.corrected_text
        except ModelInferenceError:
            predicted = None
        samples.append(score_sample(predicted, ref["corrected_text"], (perf_counter() - started) * 1000))
    return summarize(samples)


async def main() -> int:
    from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
    from src.shared.config.settings import get_settings

    parser = argparse.ArgumentParser(description="Evalúa el LLM propio con el conjunto reservado")
    parser.add_argument("--compare", nargs="*", default=["qwen2.5:3b", "qwen3:8b", "mistral"], help="Otros modelos de Ollama a comparar")
    parser.add_argument("--teacher-scores", type=Path, help="JSON con la lista de notas 1-5 de los docentes")
    parser.add_argument("--limit", type=int, default=0, help="Evaluar solo N ejemplos (prueba rápida)")
    args = parser.parse_args()

    s = get_settings()
    rows = [json.loads(line) for line in HELDOUT.read_text(encoding="utf-8").splitlines() if line.strip()]
    rows = rows[: args.limit] if args.limit else rows
    if not rows:
        print("Conjunto reservado vacío: ejecuta antes training.writing_corrector.prepare_dataset")
        return 1

    llm = OllamaClient()
    candidates = list(dict.fromkeys([s.ollama_corrector_model, s.ollama_model, *args.compare]))  # Sin duplicados, en orden
    report: dict[str, dict[str, float]] = {}
    for model in candidates:
        if not await llm.has_model(model):
            print(f"· {model}: no está en Ollama, se omite")
            continue
        report[model] = await evaluate(model, rows)
        print(f"· {model}: {report[model]}")

    own = report.get(s.ollama_corrector_model)
    if own is None:
        print(f"{s.ollama_corrector_model} no está publicado en Ollama (export_gguf.py)")
        return 1
    teacher = statistics.fmean(json.loads(args.teacher_scores.read_text())) if args.teacher_scores else None
    result = gates(own, report.get(s.ollama_model), teacher)

    info = dict(line.split("=", 1) for line in EXPORT_INFO.read_text().splitlines() if "=" in line) if EXPORT_INFO.is_file() else {}
    card = {
        "version": info.get("version"),
        "quantization": info.get("quantization"),
        "evaluated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "metrics": own | ({"teacher_score": teacher} if teacher is not None else {}),
        "gates": result,
        "comparison": report,  # Todos los modelos evaluados (auditoría)
        "samples": len(rows),
    }
    path = Path(s.own_llm_model_card_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(card, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"gates": result}, indent=2))
    return 0 if all(result.values()) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

