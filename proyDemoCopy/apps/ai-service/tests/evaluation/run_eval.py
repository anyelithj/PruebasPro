"""Evaluación comparativa del corrector del Anexo A (Sprint 5.6 → 2026-11-13 · Tarea 6 · RF-144) + recuperación del RAG (Tarea 9 · RF-57).

Compara el LLM propio (aula-corrector) con su modelo base y con Aya, Qwen y Mistral (los que estén en Ollama) sobre
`tests/evaluation/corrector_eval.jsonl` (texto propio; incluye los Casos A, B y C y errores típicos de voz).

Métricas POR SEPARADO (cada modelo pasa por el MISMO flujo del servicio: reglas → modelo → ensamblado):
  · json_valid            — salida cruda del modelo válida contra el contrato Pydantic del Anexo A
  · context_retention     — frase corregida exacta en los casos que dependen de la pregunta previa (Casos A/B y voz)
  · correction_hits       — errores esperados que el corrector marcó (recall)
  · false_positives       — errores marcados que no se esperaban (media por frase; en frases correctas, cualquiera es falso positivo)
  · score_consistency     — veredicto esperado y puntuación coherente (100 solo si «correcta»)
  · p95_ms                — latencia (RNF-03: ≤ 5000 ms)
  · translation_naturalness — media 1–5 de los docentes (--teacher-scores {"modelo": [notas]}); las traducciones se guardan en el reporte para valorarlas
  · retrieval_at_3        — casos fijos del RAG (a/an, verbo to be, niece/name, Hands To Myself) entre los 3 primeros

Regla de aceptación: un cambio (modelo o prompt) solo se acepta si NO empeora ninguna métrica frente al reporte anterior (data/eval/latest.json)
y si el modelo propio no es peor que su modelo base. Código de salida 1 si algún umbral no se cumple (paso de CI).

Uso (desde apps/ai-service):
    python -m tests.evaluation.run_eval [--compare aya-expanse:8b qwen2.5:3b mistral] [--teacher-scores notas.json] [--limit N]

[Patrón]: Test Harness + Strategy (cada modelo con la misma estrategia) | [Principio]: DRY (usa CorrectSentenceUseCase tal cual lo sirve el servicio)
+ SRP (métricas en funciones puras, probadas en tests/unit/test_run_eval_metrics.py) | [Paradigma]: Funcional (métricas) + asíncrono (inferencia).
"""

import argparse
import asyncio
import json
import statistics  # stdlib: media
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from time import perf_counter

EVAL_SET = Path(__file__).with_name("corrector_eval.jsonl")
REPORT_DIR = Path("data/eval")  # En .gitignore (data/)
EXPORT_INFO = Path("data/own_llm/export.txt")
RNF03_P95_MS = 5000
MIN_JSON_VALID = 0.98
MIN_TEACHER_SCORE = 4.0
LOWER_IS_BETTER = frozenset({"false_positives", "p95_ms"})
LATENCY_TOLERANCE = 1.10  # La latencia varía entre ejecuciones: +10 % no cuenta como empeorar


@dataclass(frozen=True)
class Sample:
    """Resultado de un caso con un modelo."""

    valid: bool  # ¿JSON del modelo válido?
    context: bool  # ¿Es un caso de contexto?
    exact: bool  # ¿Frase corregida exacta?
    hits: int  # Errores esperados encontrados
    expected: int  # Errores esperados
    false_positives: int
    consistent: bool  # Veredicto esperado + puntuación coherente
    latency_ms: float
    translation: str


def _norm(s: str) -> str:
    return " ".join(s.split()).casefold()


def _same(a: str, b: str) -> bool:
    """Dos fragmentos marcados se refieren a lo mismo si uno contiene al otro (sin mayúsculas). Función pura."""
    a, b = _norm(a), _norm(b)
    return bool(a and b) and (a in b or b in a)


def score_case(expected: dict, out: dict | None, score: int, valid: bool, context: bool, latency_ms: float) -> Sample:
    """Puntúa un caso: `out` es la corrección final (dict del Anexo A) o None si no hubo salida. Función pura."""
    wanted: list[str] = expected.get("errores", [])
    if out is None:
        return Sample(valid, context, False, 0, len(wanted), 0, False, latency_ms, "")
    marked = [e["original"] for e in out.get("errores", [])]
    hits = sum(any(_same(w, m) for m in marked) for w in wanted)
    false_pos = sum(not any(_same(m, w) for w in wanted) for m in marked)
    consistent = out.get("veredicto") == expected["veredicto"] and ((score == 100) == (out.get("veredicto") == "correcta"))
    return Sample(valid, context, _norm(out.get("frase_corregida", "")) == _norm(expected["frase_corregida"]), hits, len(wanted),
                  false_pos, consistent, latency_ms, out.get("traduccion", ""))  # fmt: skip


def summarize(samples: list[Sample]) -> dict[str, float]:
    """Métricas separadas de un modelo. Función pura."""
    latencies = sorted(s.latency_ms for s in samples)
    ctx = [s for s in samples if s.context]
    expected = sum(s.expected for s in samples)
    return {
        "json_valid": sum(s.valid for s in samples) / len(samples),
        "context_retention": sum(s.exact for s in ctx) / len(ctx) if ctx else 1.0,
        "correction_hits": sum(s.hits for s in samples) / expected if expected else 1.0,
        "false_positives": sum(s.false_positives for s in samples) / len(samples),
        "score_consistency": sum(s.consistent for s in samples) / len(samples),
        "p95_ms": latencies[min(len(latencies) - 1, int(0.95 * len(latencies)))],  # Cuantil 95 por rango más cercano
    }


def worse(current: dict[str, float], previous: dict[str, float]) -> list[str]:
    """Métricas que empeoran frente a una referencia (reporte anterior o modelo base). Función pura."""
    out = []
    for name, value in current.items():
        if name not in previous:
            continue
        before = previous[name]
        if name == "p95_ms":
            bad = value > before * LATENCY_TOLERANCE
        elif name in LOWER_IS_BETTER:
            bad = value > before + 1e-9
        else:
            bad = value < before - 1e-9
        if bad:
            out.append(name)
    return out


def gates(own: dict[str, float], base: dict[str, float] | None, previous: dict[str, float] | None, teacher: float | None) -> dict[str, bool]:
    result = {
        "json_valid_ge_98": own["json_valid"] >= MIN_JSON_VALID,
        "p95_le_rnf03": own["p95_ms"] <= RNF03_P95_MS,
        "not_worse_than_base": base is None or not worse({k: v for k, v in own.items() if k != "p95_ms"}, base),
        "no_regression": previous is None or not worse(own, previous),
    }
    if teacher is not None:
        result["teacher_score_ge_4"] = teacher >= MIN_TEACHER_SCORE
    return result


async def evaluate(model: str, rows: list[dict]) -> tuple[dict[str, float], list[str]]:
    """Mismo flujo del servicio con UN modelo: salida cruda (¿JSON válido?) → ensamblado con reglas → métricas."""
    from pydantic import ValidationError

    from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
    from src.modules.own_llm.application.schemas.corrector_io import CorrectorInput, CorrectorOutput
    from src.modules.own_llm.application.use_cases.correct_sentence import CorrectSentenceUseCase
    from src.modules.own_llm.domain.rules import RuleContext
    from src.modules.own_llm.domain.verdict import score
    from src.modules.own_llm.prompts import CORRECTOR_PROMPT
    from src.shared.config.settings import get_settings
    from src.shared.exceptions.custom_errors import ModelInferenceError

    llm = OllamaClient(timeout=get_settings().own_llm_timeout_s)
    use_case = CorrectSentenceUseCase(llm, (model,))
    samples, translations = [], []
    for row in rows:
        req = CorrectorInput.model_validate(row["entrada"])
        started = perf_counter()
        parsed: CorrectorOutput | None = None
        try:
            raw = await llm.generate(req.model_dump_json(exclude=None if req.referencias else {"referencias"}), system=CORRECTOR_PROMPT,
                                     model=model, json_mode=True, strict=True, temperature=0.1, max_tokens=900)  # fmt: skip
            parsed = CorrectorOutput.model_validate(json.loads(raw))
        except (ModelInferenceError, ValueError, ValidationError):
            parsed = None
        out = await use_case.assemble(req, RuleContext(req.idioma, question=req.pregunta_previa, spoken=req.origen == "voz"), parsed)
        latency = (perf_counter() - started) * 1000
        final = out.model_dump()
        samples.append(score_case(row["esperado"], final, score(out.veredicto, [e.categoria for e in out.errores]), parsed is not None,
                                  bool(row.get("contexto")), latency))  # fmt: skip
        translations.append(f"{row['id']}: {out.traduccion}")
    return summarize(samples), translations


def retrieval_metric() -> float | None:
    """Recuperación@3 de los casos fijos con el modelo de embeddings real (None si no está disponible)."""
    import tempfile

    from src.modules.assistant.infrastructure.vector_stores.faiss_store import FaissStore
    from src.shared.dependencies.model_deps import get_sentence_transformer
    from tests.evaluation.retrieval_cases import CORPUS, recall_at_k

    encoder = get_sentence_transformer()
    if encoder is None:
        return None
    with tempfile.TemporaryDirectory() as tmp:  # Índice temporal: no toca el índice real del servicio
        store = FaissStore(encoder, Path(tmp))
        store.rebuild(list(CORPUS))
        return recall_at_k(store, 3)


async def main() -> int:
    from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
    from src.shared.config.settings import get_settings

    parser = argparse.ArgumentParser(description="Comparativo del corrector del Anexo A y del RAG")
    parser.add_argument("--compare", nargs="*", default=["aya-expanse:8b", "qwen2.5:3b", "mistral"], help="Otros modelos de Ollama")
    parser.add_argument("--teacher-scores", type=Path, help='JSON {"modelo": [notas 1-5 de naturalidad de la traducción]}')
    parser.add_argument("--limit", type=int, default=0, help="Evaluar solo N casos (prueba rápida)")
    args = parser.parse_args()

    s = get_settings()
    rows = [json.loads(line) for line in EVAL_SET.read_text(encoding="utf-8").splitlines() if line.strip()]
    rows = rows[: args.limit] if args.limit else rows
    teacher_scores: dict[str, list[float]] = json.loads(args.teacher_scores.read_text(encoding="utf-8")) if args.teacher_scores else {}

    llm = OllamaClient()
    candidates = list(dict.fromkeys([s.ollama_corrector_model, s.ollama_model, *args.compare]))
    report: dict[str, dict[str, float]] = {}
    translations: dict[str, list[str]] = {}
    for model in candidates:
        if not await llm.has_model(model):
            print(f"· {model}: no está en Ollama, se omite")
            continue
        report[model], translations[model] = await evaluate(model, rows)
        if teacher_scores.get(model):
            report[model]["translation_naturalness"] = statistics.fmean(teacher_scores[model])
        print(f"· {model}: {report[model]}")

    retrieval = retrieval_metric()
    print(f"· RAG recuperación@3: {retrieval}")
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    latest = REPORT_DIR / "latest.json"
    previous = json.loads(latest.read_text(encoding="utf-8")) if latest.is_file() else {}

    own = report.get(s.ollama_corrector_model)
    result: dict[str, bool] = {}
    if own is not None:
        result = gates(own, report.get(s.ollama_model), previous.get("models", {}).get(s.ollama_corrector_model), own.get("translation_naturalness"))
    else:
        print(f"{s.ollama_corrector_model} no está publicado en Ollama (export_gguf.py): solo se compara el resto")
    if retrieval is not None:
        result["retrieval_no_regression"] = retrieval >= previous.get("retrieval_at_3", 0.0) - 1e-9

    stamp = datetime.now(UTC).isoformat(timespec="seconds")
    full = {"evaluated_at": stamp, "cases": len(rows), "models": report, "retrieval_at_3": retrieval, "gates": result,
            "translations_to_rate": translations}  # fmt: skip
    (REPORT_DIR / f"report-{stamp.replace(':', '')}.json").write_text(json.dumps(full, indent=2, ensure_ascii=False), encoding="utf-8")
    if all(result.values()):
        latest.write_text(json.dumps(full, indent=2, ensure_ascii=False), encoding="utf-8")  # Solo un resultado aceptado pasa a ser la referencia

    if own is not None:  # Ficha del modelo que sirve GET /own-llm/model
        info = dict(line.split("=", 1) for line in EXPORT_INFO.read_text().splitlines() if "=" in line) if EXPORT_INFO.is_file() else {}
        card = {"version": info.get("version"), "quantization": info.get("quantization"), "evaluated_at": stamp,
                "metrics": own | ({"retrieval_at_3": retrieval} if retrieval is not None else {}), "gates": result, "comparison": report,
                "samples": len(rows)}  # fmt: skip
        path = Path(s.own_llm_model_card_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(card, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"gates": result}, indent=2))
    return 0 if result and all(result.values()) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
