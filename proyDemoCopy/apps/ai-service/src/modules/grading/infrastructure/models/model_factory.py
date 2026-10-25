"""ModelFactory — instancia la Strategy adecuada para cada tipo de pregunta.

[Patron]: Factory + Strategy.
[Principio]: OCP — anadir un nuevo tipo solo agrega rama; SRP — solo construye.
[Paradigma]: POO.
"""
from functools import lru_cache

from src.modules.grading.application.schemas.grading_request import QuestionType
from src.modules.grading.domain.interfaces.grading_model import GradingModel
from src.modules.grading.infrastructure.models.exact_match_model import (
    ExactMatchModel,
)
from src.modules.grading.infrastructure.models.nlp_model import NLPModel
from src.modules.grading.infrastructure.models.similarity_model import (
    SimilarityModel,
)
from src.shared.dependencies.model_deps import (
    _load_sentence_transformer,
    _load_spacy_pipeline,
)


class ModelFactory:
    """Factoria de modelos de calificacion."""

    # [Estrategia por tipo]: el factory decide cual usar | [Patron]: Strategy
    def create(self, question_type: QuestionType) -> GradingModel:
        if question_type in (QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE):
            return _get_exact_match()
        # OPEN_ANSWER: por defecto similarity (mejor signal/ruido que NLP overlap)
        return get_similarity()

    def create_by_name(self, name: str) -> GradingModel:
        """Util para BatchGrade que recibe override explicito."""
        if name == "exact_match":
            return _get_exact_match()
        if name == "similarity":
            return get_similarity()
        if name == "nlp":
            return _get_nlp()
        raise ValueError(f"Unknown grading model: {name}")


# [Singletons cached]: cada modelo se instancia una sola vez | [Patron]: Singleton + Lazy
@lru_cache(maxsize=1)
def _get_exact_match() -> ExactMatchModel:
    return ExactMatchModel()


@lru_cache(maxsize=1)
def get_similarity() -> SimilarityModel:  # [Sprint 8.13]: pública → la usa el evaluador de respuesta abierta
    return SimilarityModel(encoder=_load_sentence_transformer())


@lru_cache(maxsize=1)
def _get_nlp() -> NLPModel:
    return NLPModel(nlp=_load_spacy_pipeline())


@lru_cache(maxsize=1)
def get_model_factory() -> ModelFactory:
    return ModelFactory()
