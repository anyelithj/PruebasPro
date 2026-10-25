"""GradeAnswerUseCase — orquesta Factory + Strategy.

[Patron]: Command + Use Case.
[Principio]: SRP + DIP — depende del Port GradingModel, no de implementaciones.
[Paradigma]: POO + asincrono.
"""
from src.modules.grading.application.schemas.grading_request import GradingRequest
from src.modules.grading.application.schemas.grading_response import GradingResponse
from src.modules.grading.infrastructure.models.model_factory import ModelFactory


class GradeAnswerUseCase:
    """Punto de entrada unico para calificar UNA respuesta."""

    def __init__(self, factory: ModelFactory) -> None:
        self._factory = factory

    async def execute(self, request: GradingRequest, user_id: str) -> GradingResponse:
        # [Strategy via Factory]: elige modelo segun tipo de pregunta
        model = self._factory.create(request.question_type)
        score, is_correct, confidence = await model.grade(request)

        return GradingResponse(
            question_id=request.question_id,
            user_id=user_id,
            score=score,
            is_correct=is_correct,
            confidence=confidence,
            feedback=None,
            strategy_used=model.name,
        )
