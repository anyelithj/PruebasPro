"""Fixtures comunes para los tests unitarios del microservicio de IA.

Provee fakes deterministas para toda dependencia de IO/red (LLM, RAG,
encoder de sentence-transformers, pipeline spaCy) de modo que las pruebas
no requieran red ni modelos pesados.
"""
from __future__ import annotations

from typing import Any

import pytest


class FakeLLMClient:
    """Doble de LLMClient (Protocol). Determinista, sin red.

    Registra los argumentos de la ultima llamada para poder hacer asserts.
    """

    def __init__(self, reply: str = "respuesta-fake", available: bool = True) -> None:
        self._reply = reply
        self._available = available
        self.calls: list[dict[str, Any]] = []

    async def generate(
        self,
        prompt: str,
        *,
        max_tokens: int = 512,
        temperature: float = 0.7,
        system: str | None = None,
    ) -> str:
        # [Registro de llamada]: permite verificar prompt/parametros en los tests
        self.calls.append(
            {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "system": system,
            }
        )
        return self._reply

    async def is_available(self) -> bool:
        return self._available


class FakeRAGRetriever:
    """Doble de RAGRetriever. Devuelve snippets fijos y registra queries."""

    def __init__(self, snippets: list[str] | None = None) -> None:
        self._snippets = snippets if snippets is not None else ["snippet-fake"]
        self.calls: list[dict[str, Any]] = []

    async def retrieve(self, query: str, *, top_k: int = 3, language: str | None = None, min_score: float = 0.3) -> list[str]:
        self.calls.append({"query": query, "top_k": top_k, "language": language})
        return self._snippets[:top_k]


class FakeEncoder:
    """Doble de SentenceTransformer.

    encode() devuelve un objeto sentinel; el calculo de coseno real se
    parchea aparte cuando se prueba el camino SBERT.
    """

    def __init__(self) -> None:
        self.encoded: list[str] = []

    def encode(self, text: str, convert_to_tensor: bool = False) -> Any:
        self.encoded.append(text)
        return f"emb::{text}"


@pytest.fixture
def fake_llm() -> FakeLLMClient:
    return FakeLLMClient()


@pytest.fixture
def fake_retriever() -> FakeRAGRetriever:
    return FakeRAGRetriever(snippets=["contexto educativo 1", "contexto educativo 2"])


@pytest.fixture
def fake_encoder() -> FakeEncoder:
    return FakeEncoder()
