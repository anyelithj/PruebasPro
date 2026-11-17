"""Tarea 9 · Pronunciación: el tutor consulta el diccionario fonético directamente (no el RAG) y entrega la IPA exacta al modelo."""

import pytest

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.value_objects.pronunciation_query import pronunciation_targets
from src.modules.assistant.infrastructure.agents.tutor_agent import TutorAgent
from src.modules.feedback.infrastructure.clients.rag_retriever import RAGRetriever
from tests.conftest import FakeLLMClient


@pytest.mark.parametrize(
    ("message", "words"),
    [
        ("¿Cómo se pronuncia «niece»?", ["niece"]),
        ("cómo se pronuncia la palabra hour", ["hour"]),
        ("how do you pronounce thought", ["thought"]),
        ("pronunciación de 'kitchen'", ["kitchen"]),
        ("no entendí el verbo to be", []),  # No es una consulta de pronunciación
    ],
)
def test_detecta_que_palabras_quiere_oir(message: str, words: list[str]) -> None:
    assert pronunciation_targets(message) == words


class FakePhonetizer:
    def __init__(self) -> None:
        self.calls: list[tuple[list[str], str]] = []

    async def ipa(self, text: str, voice: str) -> str:
        return ""

    async def ipa_words(self, words: list[str], voice: str) -> list[str]:
        self.calls.append((words, voice))
        return ["niːs" if voice.endswith("gb") else "nis" for _ in words]


class SpyRetriever(RAGRetriever):
    def __init__(self) -> None:
        super().__init__(None)
        self.asked = False

    async def references(self, *args: object, **kwargs: object) -> list:  # type: ignore[override]
        self.asked = True
        return []


async def test_la_ipa_sale_del_diccionario_y_no_se_consulta_el_rag() -> None:
    llm, retriever, phon = FakeLLMClient(), SpyRetriever(), FakePhonetizer()
    await TutorAgent(llm, retriever, phon).reply(Conversation("c", "u"), "¿Cómo se pronuncia «niece»?", "en")
    prompt = llm.calls[0]["prompt"]
    assert "PRONUNCIACIÓN (diccionario fonético espeak-ng, IPA)" in prompt and "/niːs/ (UK)" in prompt and "/nis/ (US)" in prompt
    assert not retriever.asked  # En lugar de depender del RAG
    assert "usa EXACTAMENTE esa IPA" in llm.calls[0]["system"]


async def test_sin_diccionario_el_tutor_sigue_respondiendo() -> None:
    class Broken(FakePhonetizer):
        async def ipa_words(self, words: list[str], voice: str) -> list[str]:
            raise RuntimeError("espeak-ng no instalado")

    llm = FakeLLMClient()
    reply = await TutorAgent(llm, SpyRetriever(), Broken()).reply(Conversation("c", "u"), "how do you pronounce hour", "en")
    assert reply.text and "PRONUNCIACIÓN" not in llm.calls[0]["prompt"]
