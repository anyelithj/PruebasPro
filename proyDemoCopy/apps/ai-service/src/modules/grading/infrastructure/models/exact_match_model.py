"""ExactMatchModel — Strategy para multiple_choice y true_false.

[Patron]: Strategy + Adapter.
[Principio]: SRP — solo compara strings normalizadas.
[Paradigma]: POO + Funcional.
"""
from src.modules.grading.application.schemas.grading_request import GradingRequest


def _normalize(text: str) -> str:
    """[Función pura]: quita espacios de los extremos y pasa a minúsculas (`def` en vez de lambda: nombre en trazas y tipado)."""
    return text.strip().lower()


class ExactMatchModel:
    """Comparacion case+space insensible. Score binario (0 o 1)."""

    name: str = "exact_match"

    async def grade(
        self, request: GradingRequest
    ) -> tuple[float, bool, float]:
        is_correct = _normalize(request.user_answer) == _normalize(request.correct_answer)
        score = 1.0 if is_correct else 0.0
        # [Confianza]: maxima para exact match — la regla es deterministica
        return score, is_correct, 1.0
