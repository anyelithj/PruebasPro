"""Evaluador de completar, opción múltiple y emparejar (hueco a hueco).

[Patrón]: Strategy (PracticeEvaluator).
[Principio]: determinístico — comparación normalizada contra las variantes aceptadas; sin LLM.
[Paradigma]: Funcional.
"""

from src.modules.grading.application.schemas.evaluate_request import EvaluateRequest
from src.modules.grading.application.schemas.evaluate_response import EvaluateResponse
from src.modules.grading.infrastructure.evaluators.skill_error import error_type_for
from src.shared.domain.error_finding import ErrorFinding
from src.shared.domain.text_norm import norm


class FillBlankEvaluator:
    async def evaluate(self, req: EvaluateRequest) -> EvaluateResponse:
        findings: list[ErrorFinding] = []
        hits = 0
        for i, variants in enumerate(req.accepted):
            given = req.answer[i] if i < len(req.answer) else ""
            if norm(given) in {norm(v) for v in variants}:
                hits += 1
            else:
                findings.append(
                    ErrorFinding(
                        type=error_type_for(req.skill),
                        original=given or "(vacío)",
                        correction=variants[0],
                        explanation_es=req.explanation or f"En el hueco {i + 1} la respuesta esperada es «{variants[0]}».",
                    )
                )
        total = len(req.accepted)
        return EvaluateResponse(
            correct=hits == total,
            score=round(hits / total, 2),
            findings=findings,
            correct_answer=" · ".join(v[0] for v in req.accepted),
            explanation=req.explanation,
            tip=req.tip,
        )
