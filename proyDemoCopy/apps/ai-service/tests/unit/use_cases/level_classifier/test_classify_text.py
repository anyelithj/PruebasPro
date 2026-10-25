"""Tests Sprint 9.5: indicadores deterministas, cascada a la rúbrica del LLM y respaldo si el LLM cae.

[Patrón]: Test Double (FakeLlm) + AAA.
[Principio]: determinístico primero — un texto claro se clasifica sin llamar al LLM.
"""

import json

from src.modules.level_classifier.application.schemas.classify_request import ClassifyRequest
from src.modules.level_classifier.application.use_cases.classify_text import ClassifyTextUseCase, estimate
from src.modules.level_classifier.infrastructure.clients.cefr_rubric_judge import CefrRubricJudge
from src.modules.level_classifier.infrastructure.measures.text_measures import measurer_for

A1 = " ".join(["Hi. I am Ana. I am ten. I like cats. My cat is big. It is black."] * 6)
C1 = (
    "Notwithstanding considerable methodological disagreements, contemporary researchers increasingly acknowledge that "
    "multilingual upbringing substantially reshapes executive functioning, although longitudinal evidence remains "
    "frustratingly inconclusive regarding causality, particularly when socioeconomic circumstances systematically "
    "confound otherwise promising correlations observed across heterogeneous populations and educational institutions. "
) * 3


class FakeLlm:
    def __init__(self, level: str | None) -> None:
        self.level, self.calls = level, 0

    async def generate(self, prompt: str, **_: object) -> str:
        self.calls += 1
        if self.level is None:
            raise RuntimeError("Ollama caído")
        return json.dumps({"level": self.level, "reason": "Frases complejas."})


def uc(llm: FakeLlm) -> ClassifyTextUseCase:
    return ClassifyTextUseCase(CefrRubricJudge(llm, "fake"), min_confidence=0.6)


def test_indicadores_separan_un_texto_basico_de_uno_avanzado():
    a1, c1 = estimate(measurer_for("en").measure(A1, "en")), estimate(measurer_for("en").measure(C1, "en"))
    assert a1.level in ("A1", "A2") and c1.level in ("C1", "C2")
    assert a1.indicators["avg_sentence_len"] < c1.indicators["avg_sentence_len"]


async def test_texto_claro_sin_llm_y_turnos_de_dialogo():
    llm = FakeLlm("B2")
    res = await uc(llm).execute(ClassifyRequest(language="en", turns=A1.split(". ")))
    assert res.level in ("A1", "A2") and res.estimated
    if res.confidence >= 0.6:
        assert llm.calls == 0 and res.method == "measures"


async def test_texto_corto_es_dudoso_y_decide_la_rubrica():
    llm = FakeLlm("B1")
    res = await uc(llm).execute(ClassifyRequest(language="es", text="Ayer fui al mercado con mi hermana."))
    assert llm.calls == 1 and res.method == "rubric" and res.level == "B1" and res.model == "fake"


async def test_llm_caido_conserva_los_indicadores():
    res = await uc(FakeLlm(None)).execute(ClassifyRequest(language="fr", text="Je mange une pomme."))
    assert res.method == "measures" and res.level in ("A1", "A2")


def test_chino_sin_segmentador_baja_la_confianza():
    m = measurer_for("zh").measure("我叫安娜。我十岁。我喜欢猫。" * 10, "zh")
    assert not m.segmented and estimate(m).confidence <= 0.5
