"""Tarea 9 · RF-57: sincronización por recurso (sin huérfanos), filtros, búsqueda híbrida, fragmentación, estados y casos fijos de recuperación.

[Patrón]: Test Double (codificador determinista) + Table-Driven | Con el modelo multilingüe real descargado se ejecuta también la
prueba semántica (`recall@3` = 100 %); si no está, esa prueba se omite.
"""

import numpy as np
import pytest

from src.modules.assistant.application.use_cases.reindex_knowledge import SyncKnowledgeUseCase
from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc
from src.modules.assistant.domain.knowledge_text import chunk_words, keyword_score, theme_of
from src.modules.assistant.infrastructure.repositories.knowledge_repository import indexable_statuses, to_docs
from src.modules.assistant.infrastructure.vector_stores.faiss_store import FaissStore
from src.modules.feedback.infrastructure.clients.rag_retriever import RAGRetriever, reference_lines
from tests.evaluation.retrieval_cases import CASES, CORPUS, recall_at_k


class HashEncoder:
    """Bolsa de palabras con hashing (64 ejes): determinista y sin descargar modelos."""

    def get_sentence_embedding_dimension(self) -> int:
        return 64

    def encode(self, texts: list[str], **_: object) -> np.ndarray:
        v = np.full((len(texts), 64), 1e-6)
        for row, t in enumerate(texts):
            for w in t.lower().split():
                v[row, sum(map(ord, w)) % 64] += 1.0
        return v / np.linalg.norm(v, axis=1, keepdims=True)


def doc(rid: str, text: str, **kw: object) -> KnowledgeDoc:
    return KnowledgeDoc(kw.pop("id", rid), kw.pop("language", "en"), kw.pop("level", "A1"), kw.pop("kind", "grammar_rule"), "t", text, resource_id=rid, **kw)  # type: ignore[arg-type]


def test_editar_reemplaza_y_borrar_quita_todos_los_fragmentos_sin_huerfanos(tmp_path) -> None:
    store = FaissStore(HashEncoder(), tmp_path)
    store.rebuild([doc("r1", "apple rule", id="r1#1"), doc("r1", "apple examples", id="r1#2"), doc("r2", "kitchen word")])
    store.replace_resources(["r1"], [doc("r1", "apple rule edited")])  # Edición: 2 fragmentos → 1
    assert sorted(d.id for d in store._docs) == ["r1", "r2"] and store.size == 2
    store.replace_resources(["r1"], [])  # Baja
    assert [d.resource for d in store._docs] == ["r2"]
    assert FaissStore(HashEncoder(), tmp_path).size == 1  # Persistido en disco
    assert store.search_scored("kitchen word", 3, "en", 0.0)[0][0].id == "r2"  # Los vectores conservados siguen alineados


def test_filtros_por_nivel_y_tema_y_borrador_con_menor_confianza(tmp_path) -> None:
    store = FaissStore(HashEncoder(), tmp_path)
    store.rebuild([
        doc("g", "verb to be rule", level="A1"), doc("v", "verb to be word", kind="vocabulary", level="A1"),
        doc("b2", "verb to be advanced", level="B2"), doc("d", "verb to be rule", status="borrador"),
    ])  # fmt: skip
    assert {d.id for d, _ in store.search_scored("verb to be", 5, "en", 0.0, level="A1", theme="gramatica", hybrid=True)} == {"g", "d"}
    scores = dict((d.id, s) for d, s in store.search_scored("verb to be rule", 5, "en", 0.0, hybrid=True))
    assert scores["d"] < scores["g"]  # Mismo texto: el borrador puntúa menos


def test_fragmentacion_por_concepto_y_mapeo_de_filas() -> None:
    long_body = " ".join(f"Oración número {i} de la regla." for i in range(200))  # ~1000 palabras
    parts = chunk_words("[en A1 · Articles]", long_body)
    assert len(parts) >= 2 and all(len(p.split()) <= 500 + 5 for p in parts) and all(p.startswith("[en A1 · Articles]") for p in parts)
    row = ("id-1", "en", "A1", "grammar_rule", "Articles", {"title": "a/an", "explanationEs": "Regla corta."}, "approved", "manual.pdf", None)
    (d,) = to_docs(row)
    assert (d.id, d.resource, d.status, d.origin, theme_of(d.kind)) == ("id-1", "id-1", "revisado", "manual.pdf", "gramatica")
    assert to_docs(("x", "en", "A1", "exercise", "t", {}, "approved", "", None)) == []  # Ejercicios no son material explicativo
    assert indexable_statuses(False) == ["approved", "reviewed"] and "draft" in indexable_statuses(True)


def test_palabras_clave_sin_tildes_ni_palabras_vacias() -> None:
    assert keyword_score("Gramática del verbo", "gramatica verbo to be") == 1.0
    assert keyword_score("the of de", "anything") == 0.0


async def test_sincronizacion_relee_la_bd_y_reporta_los_retirados(tmp_path) -> None:
    store = FaissStore(HashEncoder(), tmp_path)
    store.rebuild([doc("viejo", "old text"), doc("sigue", "kept")])

    class Source:
        async def docs_for(self, ids: list[str]) -> list[KnowledgeDoc]:
            return [doc("nuevo", "fresh text")]  # «viejo» se borró o volvió a borrador en la BD

    out = await SyncKnowledgeUseCase(Source(), store).execute(["viejo", "nuevo", "nuevo"])
    assert out == {"indexed": 1, "removed": ["viejo"], "size": 2}


async def test_referencias_citan_la_fuente_y_sin_material_devuelven_vacio(tmp_path, monkeypatch) -> None:
    from src.shared.config.settings import get_settings

    monkeypatch.setattr(get_settings(), "rag_min_score", 0.1)  # El codificador hash da cosenos bajos; el umbral real se calibra con el modelo
    store = FaissStore(HashEncoder(), tmp_path)
    store.rebuild(list(CORPUS))
    refs = await RAGRetriever(store).references("¿Cuándo uso a o an? ¿se dice a apple?", language="en", level="A1")
    assert 1 <= len(refs) <= 5 and refs[0].resource == "articulos-a-an"
    assert "[fuente: Articles (contenido propio)]" in reference_lines(refs)[0]
    assert await RAGRetriever(store).references("¿cómo se conjuga el subjuntivo?", language="fr") == []  # Otro idioma → sin material


@pytest.mark.parametrize(("query", "expected"), CASES)
def test_casos_fijos_en_los_3_primeros_con_busqueda_hibrida(tmp_path, query: str, expected: str) -> None:
    store = FaissStore(HashEncoder(), tmp_path)
    store.rebuild(list(CORPUS))
    assert expected in [d.resource for d, _ in store.search_scored(query, 3, "en", 0.0, hybrid=True)]


def test_casos_fijos_con_el_modelo_multilingue_real(tmp_path) -> None:
    from src.shared.dependencies.model_deps import get_sentence_transformer

    encoder = get_sentence_transformer()
    if encoder is None:
        pytest.skip("Modelo de embeddings no disponible en este equipo")
    store = FaissStore(encoder, tmp_path)
    store.rebuild(list(CORPUS))
    assert recall_at_k(store, 3) == 1.0


async def test_caso_b_el_tutor_explica_el_verbo_to_be_con_el_material_cargado(tmp_path, monkeypatch) -> None:
    from src.modules.assistant.domain.entities.conversation import Conversation
    from src.modules.assistant.domain.value_objects.message import Message
    from src.modules.assistant.infrastructure.agents.tutor_agent import TutorAgent
    from src.shared.config.settings import get_settings
    from tests.conftest import FakeLLMClient

    monkeypatch.setattr(get_settings(), "rag_min_score", 0.1)
    store = FaissStore(HashEncoder(), tmp_path)
    store.rebuild(list(CORPUS))
    question = "no entendí el tema del verbo to be"
    conv = Conversation("c", "u")
    conv.append(Message.user(question))
    llm = FakeLLMClient()
    reply = await TutorAgent(llm, RAGRetriever(store)).reply(conv, question, "en")
    prompt = llm.calls[0]["prompt"]
    assert "REFERENCIAS:" in prompt and "I am Laura = Soy Laura" in prompt and "[fuente: Verb to be" in prompt
    assert "verbo-to-be" in [s.id for s in reply.sources] and all(s.kind == "curriculum" for s in reply.sources)  # RNF-35


async def test_sin_material_el_tutor_recibe_la_orden_de_no_inventar(tmp_path) -> None:
    from src.modules.assistant.domain.entities.conversation import Conversation
    from src.modules.assistant.infrastructure.agents.tutor_agent import TutorAgent
    from tests.conftest import FakeLLMClient

    llm = FakeLLMClient()
    await TutorAgent(llm, RAGRetriever(FaissStore(HashEncoder(), tmp_path))).reply(Conversation("c", "u"), "explícame el subjuntivo", "en")
    assert "(vacío: sin material del curso" in llm.calls[0]["prompt"]
    assert "no inventes reglas" in llm.calls[0]["system"]


def test_palabras_privadas_solo_las_ve_su_dueno_y_sobreviven_al_reindexado(tmp_path) -> None:
    """[2026-11-14 · RF-137]: palabras «aprender» del usuario → fragmento privado; otro usuario o la búsqueda sin dueño no las ven."""
    store = FaissStore(HashEncoder(), tmp_path)
    store.rebuild([doc("r1", "the verb to be")])
    store.replace_resources([], [doc("user:u1:w1", "lighthouse faro", owner="u1")])
    ids = lambda owner: [d.id for d, _ in store.search_scored("lighthouse faro", 5, min_score=0.0, owner=owner)]  # noqa: E731
    assert "user:u1:w1" in ids("u1")
    assert "user:u1:w1" not in ids("u2")
    assert "user:u1:w1" not in ids(None)
    store.rebuild([doc("r1", "the verb to be")])  # «Reindexar todo» del temario
    assert "user:u1:w1" in ids("u1")
