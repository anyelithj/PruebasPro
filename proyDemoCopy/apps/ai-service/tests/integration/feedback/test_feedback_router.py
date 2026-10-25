"""Integración del router de Feedback (/api/v1/feedback).

Valida el cableado HTTP → Use Case con dobles deterministas (sin red ni Ollama).
"""
import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.modules.feedback.application.use_cases.generate_feedback import (
    GenerateFeedbackUseCase,
)
from src.modules.feedback.presentation.feedback_router import get_generate_feedback
from src.shared.dependencies.auth_deps import CurrentUser, get_current_user
from tests.conftest import FakeLLMClient, FakeRAGRetriever


# [Mock Auth]: Saltamos la validación real de JWT para el TestClient
async def override_get_current_user():
    return CurrentUser(id="u123", email="test@neuroedu.ia", role="USER")


@pytest.fixture
def client_no_auth():
    app.dependency_overrides[get_current_user] = override_get_current_user
    # [Doble del use case]: LLM y RAG falsos, deterministas y sin IO de red
    app.dependency_overrides[get_generate_feedback] = lambda: GenerateFeedbackUseCase(
        FakeLLMClient(reply="Revisa el concepto clave e inténtalo de nuevo."),
        FakeRAGRetriever(snippets=["contexto educativo 1"]),
    )
    yield
    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_generate_feedback_endpoint(client_no_auth):
    """Valida que el endpoint de feedback devuelva una respuesta pedagógica estructurada."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        payload = {
            "question_id": "q1",
            "question_text": "¿Cuál es la capital de Francia?",
            "correct_answer": "París",
            "user_answer": "Es Lyon",
            "topic": "Geografía de Europa",
        }
        response = await ac.post("/api/v1/feedback/generate", json=payload)

    assert response.status_code == 200
    data = response.json()

    assert data["question_id"] == "q1"
    assert data["feedback_type"] == "immediate"
    assert len(data["message"]) > 0
    assert data["references"] == ["contexto educativo 1"]


@pytest.mark.asyncio
async def test_analyze_weaknesses_endpoint(client_no_auth):
    """Valida el análisis de debilidades basado en la precisión por tema."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        payload = {
            "user_id": "u123",
            "topic_accuracy": {
                "Fracciones": 0.2,
                "Decimales": 0.8,
                "Ecuaciones": 0.1,
            },
            "threshold": 0.6,
        }
        response = await ac.post("/api/v1/feedback/weaknesses", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "u123"
    weak = {t["topic"] for t in data["weak_topics"]}
    assert weak == {"Fracciones", "Ecuaciones"}
    assert data["strong_topics"] == ["Decimales"]
