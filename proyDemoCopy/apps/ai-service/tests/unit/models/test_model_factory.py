"""Tests de ModelFactory — seleccion de Strategy por tipo de pregunta.

Se parchean los loaders de modelos pesados (sentence-transformers / spaCy)
para que devuelvan None y no se cargue nada real. Se limpian los lru_cache
antes de cada test para aislar el estado.
"""
import pytest

from src.modules.grading.application.schemas.grading_request import QuestionType
from src.modules.grading.infrastructure.models import model_factory as mf
from src.modules.grading.infrastructure.models.exact_match_model import ExactMatchModel
from src.modules.grading.infrastructure.models.nlp_model import NLPModel
from src.modules.grading.infrastructure.models.similarity_model import SimilarityModel


@pytest.fixture(autouse=True)
def _reset_caches(monkeypatch: pytest.MonkeyPatch):
    # [Aislamiento]: limpia singletons cacheados entre tests
    mf._get_exact_match.cache_clear()
    mf.get_similarity.cache_clear()
    mf._get_nlp.cache_clear()
    mf.get_model_factory.cache_clear()
    # [Sin modelos pesados]: loaders devuelven None (fallback determinista)
    monkeypatch.setattr(mf, "_load_sentence_transformer", lambda: None)
    monkeypatch.setattr(mf, "_load_spacy_pipeline", lambda: None)
    yield
    mf._get_exact_match.cache_clear()
    mf.get_similarity.cache_clear()
    mf._get_nlp.cache_clear()
    mf.get_model_factory.cache_clear()


class TestCreatePorTipo:
    """create() mapea QuestionType -> Strategy correcta."""

    def test_multiple_choice_usa_exact_match(self) -> None:
        factory = mf.ModelFactory()
        model = factory.create(QuestionType.MULTIPLE_CHOICE)
        assert isinstance(model, ExactMatchModel)
        assert model.name == "exact_match"

    def test_true_false_usa_exact_match(self) -> None:
        factory = mf.ModelFactory()
        model = factory.create(QuestionType.TRUE_FALSE)
        assert isinstance(model, ExactMatchModel)

    def test_open_answer_usa_similarity(self) -> None:
        factory = mf.ModelFactory()
        model = factory.create(QuestionType.OPEN_ANSWER)
        assert isinstance(model, SimilarityModel)
        assert model.name == "similarity"


class TestCreateByName:
    """create_by_name() permite override explicito."""

    def test_exact_match(self) -> None:
        assert isinstance(mf.ModelFactory().create_by_name("exact_match"), ExactMatchModel)

    def test_similarity(self) -> None:
        assert isinstance(mf.ModelFactory().create_by_name("similarity"), SimilarityModel)

    def test_nlp(self) -> None:
        assert isinstance(mf.ModelFactory().create_by_name("nlp"), NLPModel)

    def test_nombre_desconocido_lanza_value_error(self) -> None:
        with pytest.raises(ValueError, match="Unknown grading model"):
            mf.ModelFactory().create_by_name("inexistente")


class TestSingletons:
    """Los modelos se cachean (misma instancia)."""

    def test_exact_match_es_singleton(self) -> None:
        factory = mf.ModelFactory()
        assert factory.create(QuestionType.TRUE_FALSE) is factory.create(
            QuestionType.MULTIPLE_CHOICE
        )

    def test_similarity_es_singleton(self) -> None:
        factory = mf.ModelFactory()
        a = factory.create(QuestionType.OPEN_ANSWER)
        b = factory.create(QuestionType.OPEN_ANSWER)
        assert a is b

    def test_get_model_factory_cacheado(self) -> None:
        assert mf.get_model_factory() is mf.get_model_factory()
