"""Evaluador de respuesta abierta: cascada determinístico → semántico → explicación con LLM.

[Patrón]: Strategy (PracticeEvaluator) + Chain of Responsibility (exacta → similitud → LLM).
[Principio]: determinístico primero + DRY (reutiliza SimilarityModel de Grading y el OllamaClient compartido).
[Paradigma]: POO + asíncrono.
"""

from src.modules.feedback.domain.interfaces.llm_client import LLMClient
from src.modules.grading.application.schemas.evaluate_request import EvaluateRequest
from src.modules.grading.application.schemas.evaluate_response import EvaluateResponse
from src.modules.grading.infrastructure.evaluators.skill_error import error_type_for
from src.modules.grading.infrastructure.models.similarity_model import SimilarityModel
from src.shared.clients.llm_json import generate_json
from src.shared.domain.error_finding import ErrorFinding
from src.shared.domain.text_norm import norm

SEMANTIC_OK = 0.8  # Similitud mínima para aceptar una paráfrasis sin LLM
_SYSTEM = (
    "Eres profesor de idiomas. Compara la respuesta del estudiante con la respuesta modelo. Devuelve SOLO JSON: "
    '{"findings": [{"original": "fragmento del estudiante", "correction": "forma correcta", '
    '"explanation_es": "por qué, en español"}], "explanation": "resumen breve en español"}'
)


class OpenAnswerEvaluator:
    def __init__(self, similarity: SimilarityModel, llm: LLMClient) -> None:
        self._sim = similarity
        self._llm = llm

    async def evaluate(self, req: EvaluateRequest) -> EvaluateResponse:
        given = req.answer[0] if req.answer else ""
        models = req.accepted[0]
        base = {"correct_answer": models[0], "tip": req.tip}
        if norm(given) in {norm(m) for m in models}:  # 1) [Determinístico]: coincide con una respuesta modelo
            return EvaluateResponse(correct=True, score=1.0, explanation=req.explanation, **base)
        score = max(self._sim.similarity(m, given) for m in models)  # 2) [Semántico]: paráfrasis aceptable
        if score >= SEMANTIC_OK:
            return EvaluateResponse(correct=True, score=round(score, 2), explanation=req.explanation, method="semantic", **base)

        # 3) [LLM]: solo para explicar qué falta (nunca decide si es correcto)
        data = await generate_json(self._llm, f"Respuesta modelo: {models[0]}\nEstudiante: {given}", system=_SYSTEM, max_tokens=350) or {}
        findings = []
        for f in data.get("findings", [])[:5]:
            try:
                original = str(f.get("original", "")).strip()
                start = given.find(original) if original else -1  # Posición calculada aquí (los LLM cuentan mal)
                findings.append(
                    ErrorFinding(
                        type=error_type_for(req.skill),
                        original=original,
                        correction=str(f.get("correction", "")),
                        explanation_es=str(f.get("explanation_es", "")) or "Revisa este fragmento.",
                        start=start if start >= 0 else None,
                        end=start + len(original) if start >= 0 else None,
                    )
                )
            except ValueError:  # Hallazgo incompleto del LLM → se descarta, no tumba la corrección
                continue
        return EvaluateResponse(
            correct=False,
            score=round(score, 2),
            findings=findings,
            explanation=req.explanation or str(data.get("explanation", "")) or "Compara tu respuesta con la respuesta correcta.",
            method="llm" if data else "semantic",
            **base,
        )
