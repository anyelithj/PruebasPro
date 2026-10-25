"""Tests Sprint 8.13: cuatro evaluadores de práctica (Strategy) y la cascada de respuesta abierta.

[Patrón]: Test Double (FakeLlm, similitud léxica sin modelo) + AAA.
"""

import json

from src.modules.grading.application.schemas.evaluate_request import EvaluateRequest
from src.modules.grading.application.use_cases.evaluate_attempt import EvaluateAttemptUseCase
from src.modules.grading.infrastructure.evaluators.fill_blank_evaluator import FillBlankEvaluator
from src.modules.grading.infrastructure.evaluators.mark_errors_evaluator import MarkErrorsEvaluator
from src.modules.grading.infrastructure.evaluators.open_answer_evaluator import OpenAnswerEvaluator
from src.modules.grading.infrastructure.evaluators.order_evaluator import OrderEvaluator
from src.modules.grading.infrastructure.models.similarity_model import SimilarityModel
from src.shared.domain.error_finding import ErrorType


class FakeLlm:
    def __init__(self, payload: dict | None) -> None:
        self.payload, self.calls = payload, 0

    async def generate(self, prompt: str, **_: object) -> str:
        self.calls += 1
        if self.payload is None:
            raise RuntimeError("caído")
        return json.dumps(self.payload)


def uc(llm: FakeLlm | None = None) -> EvaluateAttemptUseCase:
    fb = FillBlankEvaluator()
    return EvaluateAttemptUseCase(
        {
            "multiple_choice": fb,
            "fill_blank": fb,
            "match_pairs": fb,
            "drag_order": OrderEvaluator(),
            "mark_errors": MarkErrorsEvaluator(),
            "open_answer": OpenAnswerEvaluator(SimilarityModel(None), llm or FakeLlm(None)),
        }
    )


async def test_completar_parcial_con_variantes_y_tildes():
    res = await uc().execute(
        EvaluateRequest(item_type="fill_blank", skill="vocabulary", answer=["Café", "go"], accepted=[["cafe"], ["went"]], tip="Pasado irregular")
    )
    assert not res.correct and res.score == 0.5 and res.tip == "Pasado irregular"
    assert res.findings[0].original == "go" and res.findings[0].correction == "went" and res.findings[0].type == ErrorType.VOCABULARY


async def test_ordenar_detecta_primera_ficha_fuera_de_lugar_y_acepta_otros_ordenes():
    req = dict(item_type="drag_order", skill="structure", accepted=[["I", "often", "go"], ["Often", "I", "go"]])
    ok = await uc().execute(EvaluateRequest(**req, answer=["often", "I", "go"]))
    assert ok.correct and ok.correct_answer == "Often I go"
    bad = await uc().execute(EvaluateRequest(**req, answer=["I", "go", "often"]))
    assert not bad.correct and bad.findings[0].type == ErrorType.WORD_ORDER and bad.findings[0].correction == "often"


async def test_marcar_errores_posiciones_y_falsas_alarmas():
    text = "She go to school yesterday"
    res = await uc().execute(
        EvaluateRequest(item_type="mark_errors", prompt=text, answer=["1", "3"], accepted=[["1"]], corrections={"1": "went"})
    )
    assert not res.correct and res.score == 0.0  # 1 acierto − 1 falsa alarma
    f = res.findings[0]
    assert (f.original, f.correction, text[f.start : f.end]) == ("go", "went", "go")
    assert res.correct_answer == "She went to school yesterday"


async def test_respuesta_abierta_cascada():
    req = dict(item_type="open_answer", accepted=[["I have lived here for two years"]])
    llm = FakeLlm({"findings": [{"original": "since two years", "correction": "for two years", "explanation_es": "Duración → for"}]})
    exact = await uc(llm).execute(EvaluateRequest(**req, answer=["i have lived here for two years"]))
    assert exact.correct and exact.method == "deterministic" and llm.calls == 0
    wrong = await uc(llm).execute(EvaluateRequest(**req, answer=["I live here since two years"]))
    assert not wrong.correct and wrong.method == "llm" and wrong.findings[0].start == 12
    down = await uc(FakeLlm(None)).execute(EvaluateRequest(**req, answer=["blue"]))
    assert not down.correct and down.correct_answer.startswith("I have") and down.findings == []
