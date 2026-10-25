"""Tests del RAG del tutor (Sprint 5.3): FAISS persistente, filtro por idioma, reindexación y prompt."""

import numpy as np

from src.modules.assistant.application.use_cases.reindex_knowledge import ReindexKnowledgeUseCase
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc
from src.modules.assistant.infrastructure.agents.tutor_agent import TutorAgent
from src.modules.assistant.infrastructure.repositories.knowledge_repository import _TEXT
from src.modules.assistant.infrastructure.vector_stores.faiss_store import FaissStore
from src.modules.feedback.infrastructure.clients.rag_retriever import RAGRetriever
from tests.conftest import FakeLLMClient

_VOCAB = ["saludo", "comida", "verbo"]


class BagEncoder:
    """Codificador determinista: un eje por palabra clave (sin descargar modelos)."""

    def get_sentence_embedding_dimension(self) -> int:
        return len(_VOCAB)

    def encode(self, texts: list[str], **_: object) -> np.ndarray:
        v = np.array([[float(w in t.lower()) for w in _VOCAB] for t in texts]) + 1e-6
        return v / np.linalg.norm(v, axis=1, keepdims=True)


DOCS = [
    KnowledgeDoc("1", "fr", "A1", "vocabulary", "saludos", "saludo: bonjour"),
    KnowledgeDoc("2", "en", "A1", "vocabulary", "saludos", "saludo: hello"),
    KnowledgeDoc("3", "fr", "A1", "vocabulary", "comida", "comida: pain"),
]


class FakeSource:
    async def approved_docs(self) -> list[KnowledgeDoc]:
        return DOCS


def test_busca_por_significado_filtra_idioma_y_persiste(tmp_path) -> None:
    store = FaissStore(BagEncoder(), tmp_path)
    assert store.rebuild(DOCS) == 3
    assert [d.id for d in store.search("un saludo", top_k=1, language="fr")] == ["1"]
    assert {d.id for d in store.search("saludo", top_k=5)} == {"1", "2"}  # Umbral: «comida» no aparece
    assert FaissStore(BagEncoder(), tmp_path).size == 3  # Reabre desde disco sin recodificar


def test_texto_por_tipo_de_recurso() -> None:
    text = _TEXT["vocabulary"]({"lemma": "bonjour", "translationEs": "hola", "examples": [{"text": "Bonjour!", "translationEs": "¡Hola!"}]})
    assert "bonjour" in text and "hola" in text and "¡Hola!" in text
    assert "→ correcto: «je suis»" in _TEXT["common_error"]({"incorrect": "je es", "correct": "je suis"})


async def test_reindexa_y_el_tutor_usa_el_material_del_idioma(tmp_path) -> None:
    store = FaissStore(BagEncoder(), tmp_path)
    assert (await ReindexKnowledgeUseCase(FakeSource(), store).execute())["by_language"] == {"fr": 2, "en": 1}
    llm = FakeLLMClient()
    await TutorAgent(llm, RAGRetriever(store)).reply(Conversation("c", "u"), "¿cómo es un saludo?", "fr")
    prompt = llm.calls[0]["prompt"]
    assert "bonjour" in prompt and "hello" not in prompt and "francés" in prompt


async def test_sin_codificador_no_hay_contexto() -> None:
    assert await RAGRetriever(None).retrieve("hola") == []


async def test_un_saludo_no_trae_material_ni_historial_inventado() -> None:
    # [Bug 2026-10-19]: «hola» traía vocabulario al azar y el tutor hablaba de «los ejemplos que te di»
    llm = FakeLLMClient()
    conv = Conversation("c", "u")
    from src.modules.assistant.domain.value_objects.message import Message

    conv.append(Message.user("hola"))
    retriever = RAGRetriever(None)
    await TutorAgent(llm, retriever).reply(conv, "hola", "en")
    prompt = llm.calls[0]["prompt"]
    assert "(sin material del curso" in prompt and "es el primer mensaje" in prompt
