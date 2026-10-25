"""GenerateFeedbackUseCase — feedback inmediato post-respuesta.

[Patron]: Command + Use Case.
[Principio]: SRP + DIP.
[Paradigma]: POO + asincrono.
"""
from src.modules.feedback.application.schemas.feedback_request import (
    GenerateFeedbackRequest,
)
from src.modules.feedback.application.schemas.feedback_response import FeedbackResponse
from src.modules.feedback.domain.interfaces.llm_client import LLMClient
from src.modules.feedback.domain.value_objects.feedback_type import FeedbackType
from src.modules.feedback.infrastructure.clients.rag_retriever import RAGRetriever


_SYSTEM_PROMPT = (
    "Eres un tutor pedagogico empatico. Cuando un estudiante falla una pregunta, "
    "explica brevemente por que su respuesta no es correcta y guia (sin dar la "
    "respuesta directa) hacia el concepto clave. Maximo 3 oraciones, tono motivador."
)


class GenerateFeedbackUseCase:
    """Orquesta RAG + LLM para producir feedback corto y accionable."""

    def __init__(self, llm: LLMClient, retriever: RAGRetriever) -> None:
        self._llm = llm
        self._retriever = retriever

    async def execute(self, request: GenerateFeedbackRequest) -> FeedbackResponse:
        # [Recupera contexto educativo]: RAG | [Patron]: Retrieve-Augment-Generate
        context_query = f"{request.topic or ''} {request.question_text}"
        snippets = await self._retriever.retrieve(context_query, top_k=2)

        # [Prompt compuesto]: contexto + pregunta + respuesta usuario | [Principio]: SSOT
        context_block = "\n".join(f"- {s}" for s in snippets) if snippets else "(sin contexto)"
        prompt = (
            f"Pregunta: {request.question_text}\n"
            f"Respuesta correcta: {request.correct_answer}\n"
            f"Respuesta del estudiante: {request.user_answer}\n"
            f"Contexto educativo:\n{context_block}\n\n"
            f"Genera retroalimentacion para el estudiante."
        )
        message = await self._llm.generate(
            prompt, system=_SYSTEM_PROMPT, max_tokens=200, temperature=0.7
        )

        return FeedbackResponse(
            question_id=request.question_id,
            feedback_type=FeedbackType.IMMEDIATE,
            message=message,
            suggestion=None,
            references=snippets,
        )
