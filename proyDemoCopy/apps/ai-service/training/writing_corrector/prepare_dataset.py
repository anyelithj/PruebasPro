"""Prepara el dataset del corrector de redacciones (Sprint 5.6 · RF-144).

Fuentes (solo material revisado por docentes; nunca salidas de IA sin revisar):
  1. Errores frecuentes APROBADOS del currículo (curriculum_items, kind='common_error') → ejemplos de un error.
  2. Redacciones corregidas y revisadas (JSONL opcional, --extra) con la forma CorrectionDraft + text/level.

Salida: data/own_llm/train.jsonl y data/own_llm/heldout.jsonl en formato prompt/completion (TRL SFTTrainer).
[2026-11-13 · Tarea 6]: train.jsonl también lleva los ejemplos del corrector del Anexo A ({entrada} -> {salida JSON}, con y sin «referencias»,
annex_a.py); el conjunto reservado del Anexo A es tests/evaluation/corrector_eval.jsonl (run_eval.py).
El conjunto reservado (≈10 %) se elige por hash del texto → estable entre ejecuciones y nunca entra al entrenamiento.

Uso (desde apps/ai-service):  python -m training.writing_corrector.prepare_dataset [--extra reviewed.jsonl]

[Patrón]: Pipeline ETL (extraer → transformar → cargar).
[Principio]: DRY — reutiliza SYSTEM_PROMPT/build_prompt y CorrectionDraft del servicio (lo entrenado = lo servido).
[Paradigma]: Funcional (transformaciones puras) + asíncrono (lectura de BD).
"""

import argparse  # stdlib: argumentos de línea de comandos
import asyncio
import hashlib  # stdlib: hash estable para separar el conjunto reservado
import json
from collections.abc import Iterable, Iterator
from pathlib import Path

from sqlalchemy import text as sql

from src.modules.own_llm.application.schemas.writing_request import OWN_MODEL_LANGUAGES, SUPPORTED_LEVELS
from src.modules.own_llm.application.schemas.writing_response import CorrectionDraft
from src.modules.own_llm.infrastructure.models.writing_corrector_model import SYSTEM_PROMPT, build_prompt
from training.writing_corrector.annex_a import annex_records  # [Tarea 6]: ejemplos del Anexo A

OUT_DIR = Path("data/own_llm")
HELDOUT_PERCENT = 10

_SQL = sql(
    "SELECT language::text AS language, level::text AS level, content FROM curriculum_items "
    "WHERE kind = 'common_error' AND review_status = 'approved' AND language::text = ANY(:langs)"
)


async def load_common_errors() -> list[dict]:
    """Errores frecuentes aprobados → ejemplos {text, language, level, target}."""
    from src.shared.config.database import async_session_factory  # Import perezoso: el script corre sin BD si solo usa --extra

    async with async_session_factory() as session:
        # [Dataset]: solo los idiomas del modelo propio (OWN_MODEL_LANGUAGES en writing_request.py)
        rows = (await session.execute(_SQL, {"langs": list(OWN_MODEL_LANGUAGES)})).mappings().all()
    examples = []
    for r in rows:
        c = r["content"]
        if r["level"] not in SUPPORTED_LEVELS:
            continue
        target = CorrectionDraft(
            findings=[{"type": "grammar", "original": c["incorrect"], "correction": c["correct"], "explanation_es": c["explanationEs"]}],
            corrected_text=c["correct"],
            explanation_es=c["explanationEs"],
        )
        examples.append({"text": c["incorrect"], "language": r["language"], "level": r["level"], "target": target})
    return examples


def load_extra(path: Path) -> Iterator[dict]:
    """JSONL revisado: cada línea = {text, language, level, findings, corrected_text, explanation_es}."""
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            row = json.loads(line)
            yield {"text": row["text"], "language": row.get("language", "en"), "level": row.get("level", "B1"), "target": CorrectionDraft.model_validate(row)}


def to_record(ex: dict) -> dict:
    """Ejemplo → registro conversacional prompt/completion (función pura)."""
    return {
        "prompt": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(ex["text"], ex["language"], ex["level"])},
        ],
        "completion": [{"role": "assistant", "content": ex["target"].model_dump_json(exclude={"findings": {"__all__": {"start", "end"}}})}],
        # Referencia para run_eval.py (no la usa el entrenamiento)
        "reference": {"text": ex["text"], "language": ex["language"], "level": ex["level"], "corrected_text": ex["target"].corrected_text},
    }


def is_heldout(text: str) -> bool:
    return int(hashlib.sha256(text.encode()).hexdigest(), 16) % 100 < HELDOUT_PERCENT


def write_split(examples: Iterable[dict], out_dir: Path) -> tuple[int, int]:
    out_dir.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()  # Sin duplicados (el mismo texto en dos fuentes)
    counts = [0, 0]
    with (out_dir / "train.jsonl").open("w", encoding="utf-8") as train, (out_dir / "heldout.jsonl").open("w", encoding="utf-8") as held:
        for ex in examples:
            if ex["text"] in seen:
                continue
            seen.add(ex["text"])
            split = is_heldout(ex["text"])
            (held if split else train).write(json.dumps(to_record(ex), ensure_ascii=False) + "\n")
            counts[split] += 1
    return counts[0], counts[1]


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--extra", type=Path, help="JSONL de redacciones revisadas por docentes")
    parser.add_argument("--no-db", action="store_true", help="No leer el currículo (solo --extra)")
    args = parser.parse_args()

    examples = [] if args.no_db else await load_common_errors()
    if args.extra:
        examples.extend(load_extra(args.extra))
    train, held = write_split(examples, OUT_DIR)
    annex = annex_records()  # [Tarea 6]: Anexo A (Casos A, B, C y errores de voz), con y sin referencias
    with (OUT_DIR / "train.jsonl").open("a", encoding="utf-8") as f:
        f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in annex)  # JSONL: un registro por línea
    print(f"train={train + len(annex)} (Anexo A: {len(annex)}) heldout={held} -> {OUT_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
