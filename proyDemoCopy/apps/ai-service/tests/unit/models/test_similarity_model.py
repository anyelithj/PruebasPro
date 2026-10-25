"""Tests de SimilarityModel — caminos SBERT (encoder) y fallback lexical."""
import sys
import types

import pytest

from src.modules.grading.application.schemas.grading_request import (
    GradingRequest,
    QuestionType,
)
from src.modules.grading.infrastructure.models.similarity_model import SimilarityModel


def _request(correct: str, user: str, threshold: float = 0.75) -> GradingRequest:
    return GradingRequest(
        question_id="q1",
        question_type=QuestionType.OPEN_ANSWER,
        question_text="¿pregunta?",
        correct_answer=correct,
        user_answer=user,
        similarity_threshold=threshold,
    )


class TestFallbackLexical:
    """Sin encoder usa difflib SequenceMatcher con confidence 0.6."""

    @pytest.mark.asyncio
    async def test_textos_identicos_score_uno(self) -> None:
        model = SimilarityModel(encoder=None)
        score, is_correct, conf = await model.grade(_request("la capital es paris", "la capital es paris"))
        assert score == pytest.approx(1.0)
        assert is_correct is True
        assert conf == 0.6

    @pytest.mark.asyncio
    async def test_textos_dispares_score_bajo(self) -> None:
        model = SimilarityModel(encoder=None)
        score, is_correct, conf = await model.grade(_request("paris", "xyzqwk"))
        assert score < 0.75
        assert is_correct is False
        assert conf == 0.6

    @pytest.mark.asyncio
    async def test_respuesta_vacia_score_cero(self) -> None:
        model = SimilarityModel(encoder=None)
        # [Borde]: user_answer vacio -> _lexical_similarity retorna 0.0
        score, is_correct, _ = await model.grade(_request("paris", ""))
        assert score == 0.0
        assert is_correct is False

    @pytest.mark.asyncio
    async def test_respeta_umbral_personalizado(self) -> None:
        model = SimilarityModel(encoder=None)
        # [Umbral 0.0]: cualquier similitud >= 0 es correcta
        _, is_correct, _ = await model.grade(_request("paris", "londres", threshold=0.0))
        assert is_correct is True

    def test_nombre_strategy(self) -> None:
        assert SimilarityModel(encoder=None).name == "similarity"


class TestCaminoSBERT:
    """Con encoder usa sentence_transformers.util (mockeado), confidence 0.85."""

    @pytest.mark.asyncio
    async def test_usa_encoder_y_cosine(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # [Mock del modulo sentence_transformers.util]: cos_sim controlado
        class _FakeSim:
            def item(self) -> float:
                return 0.9

        fake_util = types.SimpleNamespace(cos_sim=lambda a, b: _FakeSim())
        fake_st = types.ModuleType("sentence_transformers")
        fake_st.util = fake_util  # type: ignore[attr-defined]
        monkeypatch.setitem(sys.modules, "sentence_transformers", fake_st)

        class _Encoder:
            def __init__(self) -> None:
                self.calls: list[str] = []

            def encode(self, text: str, convert_to_tensor: bool = False):
                self.calls.append(text)
                return text

        encoder = _Encoder()
        model = SimilarityModel(encoder=encoder)
        score, is_correct, conf = await model.grade(_request("paris", "paris"))

        assert score == pytest.approx(0.9)
        assert is_correct is True
        assert conf == 0.85
        # [Verifica]: encoder.encode invocado para ambos textos
        assert encoder.calls == ["paris", "paris"]

    @pytest.mark.asyncio
    async def test_cosine_negativo_se_normaliza_a_cero(self, monkeypatch: pytest.MonkeyPatch) -> None:
        class _FakeSim:
            def item(self) -> float:
                return -0.4

        fake_util = types.SimpleNamespace(cos_sim=lambda a, b: _FakeSim())
        fake_st = types.ModuleType("sentence_transformers")
        fake_st.util = fake_util  # type: ignore[attr-defined]
        monkeypatch.setitem(sys.modules, "sentence_transformers", fake_st)

        class _Encoder:
            def encode(self, text: str, convert_to_tensor: bool = False):
                return text

        model = SimilarityModel(encoder=_Encoder())
        score, is_correct, _ = await model.grade(_request("a", "b"))
        # [Normalizacion]: max(0, min(1, sim)) -> 0.0
        assert score == 0.0
        assert is_correct is False
