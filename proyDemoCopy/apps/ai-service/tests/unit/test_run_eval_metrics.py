"""Tarea 6 · RF-144: métricas separadas del comparativo (run_eval.py) y regla «un cambio solo se acepta si no empeora». Funciones puras."""

import json
from pathlib import Path

from src.modules.own_llm.application.schemas.corrector_io import CorrectorInput
from tests.evaluation.run_eval import EVAL_SET, gates, score_case, summarize, worse

EXPECTED_A = {"frase_corregida": "My name is Laura. I'm from Colombia.", "veredicto": "con_errores", "errores": ["niece", "Columbia"]}


def test_score_case_aciertos_falsos_positivos_y_coherencia() -> None:
    out = {"frase_corregida": "My name is Laura. I'm from Colombia.", "veredicto": "con_errores",
           "errores": [{"original": "niece"}, {"original": "Columbia"}, {"original": "Laura"}], "traduccion": "Me llamo Laura."}  # fmt: skip
    s = score_case(EXPECTED_A, out, 40, True, True, 120.0)
    assert (s.hits, s.expected, s.false_positives, s.exact, s.consistent) == (2, 2, 1, True, True)
    assert not score_case(EXPECTED_A, {**out, "veredicto": "correcta"}, 100, True, True, 1.0).consistent  # 100 % con errores esperados: mal
    assert score_case(EXPECTED_A, None, 0, False, True, 1.0).valid is False


def test_summarize_separa_metricas() -> None:
    a = score_case(EXPECTED_A, {"frase_corregida": "My name is Laura. I'm from Colombia.", "veredicto": "con_errores", "errores": [{"original": "niece"}]}, 50, True, True, 100)
    b = score_case({"frase_corregida": "Ok.", "veredicto": "correcta", "errores": []}, {"frase_corregida": "Ok.", "veredicto": "correcta", "errores": []}, 100, False, False, 300)
    m = summarize([a, b])
    assert m == {"json_valid": 0.5, "context_retention": 1.0, "correction_hits": 0.5, "false_positives": 0.0, "score_consistency": 1.0, "p95_ms": 300}


def test_no_se_acepta_un_cambio_que_empeora() -> None:
    before = {"json_valid": 1.0, "false_positives": 0.1, "p95_ms": 1000}
    assert worse({"json_valid": 1.0, "false_positives": 0.1, "p95_ms": 1090}, before) == []  # +9 % de latencia: tolerado
    assert worse({"json_valid": 0.9, "false_positives": 0.2, "p95_ms": 1200}, before) == ["json_valid", "false_positives", "p95_ms"]
    own = {"json_valid": 1.0, "context_retention": 1.0, "correction_hits": 1.0, "false_positives": 0.0, "score_consistency": 1.0, "p95_ms": 900}
    g = gates(own, {**own, "context_retention": 0.5}, {**own, "correction_hits": 1.0}, 4.2)
    assert g == {"json_valid_ge_98": True, "p95_le_rnf03": True, "not_worse_than_base": True, "no_regression": True, "teacher_score_ge_4": True}
    assert gates({**own, "context_retention": 0.4}, own, None, None)["not_worse_than_base"] is False


def test_el_conjunto_reservado_es_valido_y_cubre_los_casos_a_b_c_y_voz() -> None:
    rows = [json.loads(line) for line in Path(EVAL_SET).read_text(encoding="utf-8").splitlines() if line.strip()]
    for row in rows:
        CorrectorInput.model_validate(row["entrada"])  # Cada entrada cumple el Anexo A
    ids = {r["id"] for r in rows}
    assert {"caso-a-voz", "caso-b-duda", "caso-c-titulo"} <= ids
    assert sum(r["entrada"]["origen"] == "voz" for r in rows) >= 3 and any(r["entrada"].get("referencias") for r in rows)


def test_datos_qlora_del_anexo_a_con_y_sin_referencias_y_casos_a_b_c() -> None:
    from src.modules.own_llm.prompts import CORRECTOR_PROMPT
    from training.writing_corrector.annex_a import annex_records

    records = annex_records()
    users = [json.loads(r["prompt"][1]["content"]) for r in records]
    assert all(r["prompt"][0]["content"] == CORRECTOR_PROMPT for r in records)  # El prompt versionado tal cual
    assert any("referencias" in u for u in users) and any("referencias" not in u for u in users)
    textos = {u["texto"] for u in users}
    assert {"my niece is Laura I'm on from Columbia", "no entendí el tema del verbo to be", "Hands To Myself"} <= textos
    assert sum(u["origen"] == "voz" for u in users) >= 4
