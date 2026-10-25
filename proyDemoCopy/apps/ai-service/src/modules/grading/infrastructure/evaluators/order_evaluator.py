"""Evaluador de ordenar por arrastre (estructura de la oración).

[Patrón]: Strategy (PracticeEvaluator).
[Principio]: determinístico — compara con los órdenes aceptados y señala la primera ficha fuera de lugar.
[Paradigma]: Funcional.
"""

from src.modules.grading.application.schemas.evaluate_request import EvaluateRequest
from src.modules.grading.application.schemas.evaluate_response import EvaluateResponse
from src.modules.grading.infrastructure.evaluators.skill_error import error_type_for
from src.shared.domain.error_finding import ErrorFinding
from src.shared.domain.text_norm import norm


class OrderEvaluator:
    async def evaluate(self, req: EvaluateRequest) -> EvaluateResponse:
        given = [norm(t) for t in req.answer]
        orders = [[norm(t) for t in order] for order in req.accepted]
        # [Mejor coincidencia]: el orden aceptado con más fichas en su sitio (puede haber varias formas correctas)
        best = max(range(len(orders)), key=lambda k: sum(a == b for a, b in zip(given, orders[k])))
        target = req.accepted[best]
        placed = sum(a == b for a, b in zip(given, orders[best]))
        correct = given == orders[best]
        findings = []
        if not correct:
            i = next((k for k, (a, b) in enumerate(zip(given, orders[best])) if a != b), min(len(given), len(target) - 1))
            sentence = " ".join(req.answer)
            start = len(" ".join(req.answer[:i])) + (1 if i else 0)  # Posición de la ficha fuera de lugar en la frase
            wrong = req.answer[i] if i < len(req.answer) else ""
            findings.append(
                ErrorFinding(
                    type=error_type_for(req.skill),
                    original=wrong or "(falta)",
                    correction=target[i],
                    explanation_es=req.explanation or f"En la posición {i + 1} va «{target[i]}».",
                    start=start if wrong else None,
                    end=start + len(wrong) if wrong and start + len(wrong) <= len(sentence) else None,
                )
            )
        return EvaluateResponse(
            correct=correct,
            score=round(placed / len(target), 2),
            findings=findings,
            correct_answer=" ".join(target),
            explanation=req.explanation,
            tip=req.tip,
        )
