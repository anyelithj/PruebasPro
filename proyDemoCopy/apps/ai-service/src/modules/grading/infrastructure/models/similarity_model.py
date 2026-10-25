"""SimilarityModel — Strategy via sentence-transformers cosine similarity.

[Patron]: Strategy + Adapter (sentence-transformers).
[Principio]: SRP + DIP — el factory inyecta el modelo cargado.
[Paradigma]: POO + asincrono.

[Fallback]: si sentence-transformers no esta instalado, usa SequenceMatcher (difflib) que
da resultados razonables sin GPU/modelo pesado.
"""
from difflib import SequenceMatcher
from typing import Any

from src.modules.grading.application.schemas.grading_request import GradingRequest


class SimilarityModel:
    """Similitud semantica para preguntas abiertas."""

    name: str = "similarity"

    def __init__(self, encoder: Any | None = None) -> None:
        # [Encoder opcional]: SentenceTransformer ya cargado, o None para fallback
        self._encoder = encoder

    async def grade(
        self, request: GradingRequest
    ) -> tuple[float, bool, float]:
        if self._encoder is not None:
            score = self._cosine_similarity_sbert(
                request.correct_answer,
                request.user_answer,
            )
            confidence = 0.85  # SBERT bastante confiable para semantica
        else:
            score = self._lexical_similarity(
                request.correct_answer,
                request.user_answer,
            )
            confidence = 0.6  # menor — solo lexical

        is_correct = score >= request.similarity_threshold
        return score, is_correct, confidence

    def similarity(self, a: str, b: str) -> float:
        """[Sprint 8.13]: similitud 0..1 (SBERT si hay codificador; si no, difflib) — la reutiliza el evaluador de práctica (DRY)."""
        return self._cosine_similarity_sbert(a, b) if self._encoder is not None else self._lexical_similarity(a, b)

    def _cosine_similarity_sbert(self, a: str, b: str) -> float:
        """Coseno via sentence-transformers. Requiere encoder cargado."""
        # [Import perezoso]: solo si se invoca este path
        from sentence_transformers import util  # type: ignore[import-not-found]

        emb_a = self._encoder.encode(a, convert_to_tensor=True)  # type: ignore[union-attr]
        emb_b = self._encoder.encode(b, convert_to_tensor=True)  # type: ignore[union-attr]
        sim = float(util.cos_sim(emb_a, emb_b).item())
        # [Normalizar a 0..1]: cos sim puede ser negativa
        return max(0.0, min(1.0, sim))

    def _lexical_similarity(self, a: str, b: str) -> float:
        """Fallback: similitud lexical Ratcliff/Obershelp via difflib."""
        if not a or not b:
            return 0.0
        return SequenceMatcher(None, a.strip().lower(), b.strip().lower()).ratio()
