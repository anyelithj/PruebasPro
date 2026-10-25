"""Evaluador «marcar errores»: el estudiante pulsa las palabras incorrectas de un texto.

[Patrón]: Strategy (PracticeEvaluator).
[Principio]: determinístico — conjuntos de índices (aciertos, olvidos y falsas alarmas); posiciones calculadas por el servidor.
[Paradigma]: Funcional.
"""

import re

from src.modules.grading.application.schemas.evaluate_request import EvaluateRequest
from src.modules.grading.application.schemas.evaluate_response import EvaluateResponse
from src.modules.grading.infrastructure.evaluators.skill_error import error_type_for
from src.shared.domain.error_finding import ErrorFinding


def tokens(text: str) -> list[tuple[str, int, int]]:
    """Palabras con su posición [start, end) en el texto — mismo criterio que la UI (separar por espacios)."""
    return [(m.group(0), m.start(), m.end()) for m in re.finditer(r"\S+", text)]


class MarkErrorsEvaluator:
    async def evaluate(self, req: EvaluateRequest) -> EvaluateResponse:
        toks = tokens(req.prompt)
        expected = {int(i) for i in req.accepted[0] if i.isdigit() and int(i) < len(toks)}
        marked = {int(i) for i in req.answer if i.isdigit() and int(i) < len(toks)}
        hits, missed, false_alarms = expected & marked, expected - marked, marked - expected
        findings = [
            ErrorFinding(
                type=error_type_for(req.skill),
                original=toks[i][0],
                correction=req.corrections.get(str(i), toks[i][0]),
                explanation_es=req.explanation or ("Este error no lo marcaste." if i in missed else "Bien visto: aquí hay un error."),
                start=toks[i][1],
                end=toks[i][2],
            )
            for i in sorted(missed | hits)
        ]
        # [Puntaje]: aciertos menos falsas alarmas, sobre el total de errores (nunca negativo)
        score = max(len(hits) - len(false_alarms), 0) / max(len(expected), 1)
        corrected = " ".join(req.corrections.get(str(i), t[0]) for i, t in enumerate(toks))
        return EvaluateResponse(
            correct=not missed and not false_alarms,
            score=round(score, 2),
            findings=findings,
            correct_answer=corrected,
            explanation=req.explanation,
            tip=req.tip,
        )
