"""NLPModel — Strategy via spaCy para analisis lexico/sintactico.

[Patron]: Strategy + Adapter (spaCy).
[Principio]: SRP.
[Paradigma]: POO.

[Fallback]: si spaCy no esta disponible o el modelo no se cargo, usa overlap de tokens
simples — suficiente para preguntas con palabras clave.
"""
from typing import Any

from src.modules.grading.application.schemas.grading_request import GradingRequest


class NLPModel:
    """Comparacion via lemmas + token overlap."""

    name: str = "nlp"

    def __init__(self, nlp: Any | None = None) -> None:
        self._nlp = nlp

    async def grade(
        self, request: GradingRequest
    ) -> tuple[float, bool, float]:
        if self._nlp is not None:
            score = self._lemma_overlap(request.correct_answer, request.user_answer)
            confidence = 0.75
        else:
            score = self._token_overlap(request.correct_answer, request.user_answer)
            confidence = 0.55

        is_correct = score >= request.similarity_threshold
        return score, is_correct, confidence

    def _lemma_overlap(self, a: str, b: str) -> float:
        """Jaccard sobre lemmas (sin stopwords)."""
        doc_a = self._nlp(a.lower())  # type: ignore[union-attr]
        doc_b = self._nlp(b.lower())  # type: ignore[union-attr]
        set_a = {t.lemma_ for t in doc_a if not t.is_stop and t.is_alpha}
        set_b = {t.lemma_ for t in doc_b if not t.is_stop and t.is_alpha}
        if not set_a or not set_b:
            return 0.0
        inter = len(set_a & set_b)
        union = len(set_a | set_b)
        return inter / union if union > 0 else 0.0

    def _token_overlap(self, a: str, b: str) -> float:
        """Fallback: Jaccard sobre tokens crudos."""
        set_a = set(a.lower().split())
        set_b = set(b.lower().split())
        if not set_a or not set_b:
            return 0.0
        inter = len(set_a & set_b)
        union = len(set_a | set_b)
        return inter / union if union > 0 else 0.0
