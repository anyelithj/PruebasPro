"""Pruebas unitarias del LLM propio (Sprint 5.6): cadena de respaldo, contrato JSON y ubicación de errores.

[Patrón]: Test Double (FakeLlm) — sin Ollama ni red.
[Paradigma]: pytest asíncrono (asyncio_mode=auto).
"""

import json

import pytest

from src.modules.own_llm.application.schemas.writing_request import WritingRequest
from src.modules.own_llm.application.use_cases.correct_writing import CorrectWritingUseCase
from src.modules.own_llm.infrastructure.models.writing_corrector_model import (
    WritingCorrectorModel,
    locate_findings,
)
from src.shared.domain.error_finding import ErrorFinding
from src.shared.exceptions.custom_errors import ModelInferenceError

TEXT = "She go to school every days."
GOOD = json.dumps(
    {
        "findings": [
            {"type": "grammar", "original": "go", "correction": "goes", "explanation_es": "Tercera persona: -s."},
            {"type": "grammar", "original": "days", "correction": "day", "explanation_es": "every va con singular."},
            {"type": "vocabulary", "original": "college", "correction": "school", "explanation_es": "No aparece."},
        ],
        "corrected_text": "She goes to school every day.",
        "explanation_es": "Concordancia verbal y número.",
    }
)


class FakeLlm:
    """Responde por modelo: str = salida, Exception = fallo."""

    def __init__(self, replies: dict[str, object]) -> None:
        self.replies, self.calls = replies, []

    async def generate(self, prompt: str, **kw) -> str:
        self.calls.append(kw["model"])
        reply = self.replies[kw["model"]]
        if isinstance(reply, Exception):
            raise reply
        return reply


def use_case(replies: dict[str, object]) -> tuple[CorrectWritingUseCase, FakeLlm]:
    llm = FakeLlm(replies)
    return CorrectWritingUseCase(WritingCorrectorModel(llm, ("aula-corrector", "base"))), llm


async def test_own_model_answers_without_fallback():
    uc, llm = use_case({"aula-corrector": GOOD})
    res = await uc.execute(WritingRequest(text=TEXT, level="A2"))
    assert res.model_used == "aula-corrector" and not res.fallback_used
    assert llm.calls == ["aula-corrector"]
    assert res.flags == ["REQUIERE_REVISION"]  # Nunca se presenta como verificado
    # Posiciones calculadas en el servidor y hallazgo alucinado ("college") descartado
    assert [(f.original, f.start, f.end) for f in res.findings] == [("go", 4, 6), ("days", 23, 27)]


@pytest.mark.parametrize("failure", [ModelInferenceError("model not found"), "not json", '{"findings": []}'])
async def test_falls_back_to_base_model(failure):
    uc, llm = use_case({"aula-corrector": failure, "base": GOOD})
    res = await uc.execute(WritingRequest(text=TEXT))
    assert res.model_used == "base" and res.fallback_used
    assert llm.calls == ["aula-corrector", "base"]


async def test_all_models_fail_raises_503():
    uc, _ = use_case({"aula-corrector": ModelInferenceError("x"), "base": "{}"})
    with pytest.raises(ModelInferenceError) as exc:
        await uc.execute(WritingRequest(text=TEXT))
    assert exc.value.status_code == 503


def test_repeated_fragment_is_located_twice():
    f = ErrorFinding(original="a", correction="an", explanation_es="vocal")
    assert [(x.start, x.end) for x in locate_findings("a apple and a orange", [f, f])] == [(0, 1), (12, 13)]


def test_scope_rejects_unsupported_language():
    with pytest.raises(ValueError):
        WritingRequest(text=TEXT, language="it")  # Fuera de los 7 idiomas de la plataforma


async def test_other_languages_go_straight_to_base_model():
    """El modelo propio solo se entrenó en inglés → francés usa el modelo base y no cuenta como respaldo."""
    fr = json.dumps({"findings": [{"type": "grammar", "original": "allez", "correction": "vais", "explanation_es": "1.ª persona."}], "corrected_text": "Je vais", "explanation_es": "Conjugación."})
    uc, llm = use_case({"base": fr})
    res = await uc.execute(WritingRequest(text="Je allez au cinéma", language="fr", level="C1"))
    assert llm.calls == ["base"] and res.model_used == "base" and not res.fallback_used
    assert (res.findings[0].start, res.findings[0].end) == (3, 8)


def test_chinese_fragments_located_without_word_boundaries():
    f = ErrorFinding(type="grammar", original="很", correction="非常", explanation_es="x")
    assert [(x.start, x.end) for x in locate_findings("我很喜欢", [f], word_boundaries=False)] == [(1, 2)]
    assert locate_findings("我很喜欢", [f]) == []  # Con límites de palabra el fragmento no se encontraría


def test_eval_gates_and_dataset_record():
    """run_eval: umbrales; prepare_dataset: el registro usa el MISMO prompt que el servicio."""
    from tests.evaluation.run_eval import gates, score_sample, summarize
    from training.writing_corrector.prepare_dataset import to_record
    from src.modules.own_llm.application.schemas.writing_response import CorrectionDraft
    from src.modules.own_llm.infrastructure.models.writing_corrector_model import build_prompt

    own = summarize([score_sample("She goes.", "she  goes.", 100), score_sample(None, "x", 200)])
    assert own["json_valid"] == 0.5 and own["exact_match"] == 0.5 and own["p95_ms"] == 200
    assert gates(own, {"similarity": 0.1}, None) == {"json_valid_ge_98": False, "p95_le_rnf03": True, "better_than_base": True}
    assert gates(own, None, 4.5)["teacher_score_ge_4"] is True

    rec = to_record({"text": "She go.", "language": "en", "level": "A1", "target": CorrectionDraft(corrected_text="She goes.")})
    assert rec["prompt"][1]["content"] == build_prompt("She go.", "en", "A1")
    assert CorrectionDraft.model_validate_json(rec["completion"][0]["content"]).corrected_text == "She goes."
