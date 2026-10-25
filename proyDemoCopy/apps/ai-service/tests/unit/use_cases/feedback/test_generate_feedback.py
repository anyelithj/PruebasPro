"""Tests de GenerateFeedbackUseCase — RAG + LLM (ambos mockeados/fakes)."""
import pytest

from src.modules.feedback.application.schemas.feedback_request import (
    GenerateFeedbackRequest,
)
from src.modules.feedback.application.use_cases.generate_feedback import (
    GenerateFeedbackUseCase,
)
from src.modules.feedback.domain.value_objects.feedback_type import FeedbackType


def _request(topic: str | None = "math") -> GenerateFeedbackRequest:
    return GenerateFeedbackRequest(
        question_id="q1",
        question_text="¿Cuanto es 2+2?",
        correct_answer="4",
        user_answer="5",
        topic=topic,
    )


class TestGenerateFeedback:
    @pytest.mark.asyncio
    async def test_camino_feliz(self, fake_llm, fake_retriever) -> None:
        use_case = GenerateFeedbackUseCase(llm=fake_llm, retriever=fake_retriever)
        resp = await use_case.execute(_request())

        assert resp.question_id == "q1"
        assert resp.feedback_type == FeedbackType.IMMEDIATE
        assert resp.message == "respuesta-fake"
        assert resp.suggestion is None
        # [references]: vienen del retriever
        assert resp.references == ["contexto educativo 1", "contexto educativo 2"]

    @pytest.mark.asyncio
    async def test_retriever_invocado_con_query_compuesta(self, fake_llm, fake_retriever) -> None:
        use_case = GenerateFeedbackUseCase(llm=fake_llm, retriever=fake_retriever)
        await use_case.execute(_request(topic="algebra"))
        # [Query]: topic + question_text, top_k=2
        call = fake_retriever.calls[0]
        assert "algebra" in call["query"]
        assert "2+2" in call["query"]
        assert call["top_k"] == 2

    @pytest.mark.asyncio
    async def test_llm_recibe_prompt_y_parametros(self, fake_llm, fake_retriever) -> None:
        use_case = GenerateFeedbackUseCase(llm=fake_llm, retriever=fake_retriever)
        await use_case.execute(_request())

        call = fake_llm.calls[0]
        # [Prompt]: incluye datos de la pregunta y contexto
        assert "Respuesta correcta: 4" in call["prompt"]
        assert "Respuesta del estudiante: 5" in call["prompt"]
        assert "contexto educativo 1" in call["prompt"]
        assert call["max_tokens"] == 200
        assert call["temperature"] == 0.7
        assert call["system"] is not None

    @pytest.mark.asyncio
    async def test_sin_topic_usa_solo_question_text(self, fake_llm, fake_retriever) -> None:
        use_case = GenerateFeedbackUseCase(llm=fake_llm, retriever=fake_retriever)
        await use_case.execute(_request(topic=None))
        # [topic None]: query comienza con espacio + question_text, sin romper
        assert "2+2" in fake_retriever.calls[0]["query"]

    @pytest.mark.asyncio
    async def test_sin_snippets_usa_marcador_sin_contexto(self, fake_llm) -> None:
        from tests.conftest import FakeRAGRetriever

        empty_retriever = FakeRAGRetriever(snippets=[])
        use_case = GenerateFeedbackUseCase(llm=fake_llm, retriever=empty_retriever)
        resp = await use_case.execute(_request())

        assert resp.references == []
        # [Rama sin contexto]: el prompt incluye el marcador
        assert "(sin contexto)" in fake_llm.calls[0]["prompt"]

    @pytest.mark.asyncio
    async def test_propaga_error_del_llm(self, fake_retriever) -> None:
        from src.shared.exceptions.custom_errors import ExternalServiceError

        class _FailingLLM:
            async def generate(self, *a, **k) -> str:
                raise ExternalServiceError("ollama down")

            async def is_available(self) -> bool:
                return False

        use_case = GenerateFeedbackUseCase(llm=_FailingLLM(), retriever=fake_retriever)
        with pytest.raises(ExternalServiceError, match="ollama down"):
            await use_case.execute(_request())
