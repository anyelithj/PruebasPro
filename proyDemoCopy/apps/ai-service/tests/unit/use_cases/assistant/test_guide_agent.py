"""Tests del Agente Guía (Sprint 7.9 · RF-96): FAQ sin LLM → manual con citas → «no lo sé», filtro por rol e índice por secciones."""

import numpy as np

from src.modules.assistant.application.use_cases.reindex_manual import ManualArticleIn, ReindexManualUseCase, split_sections
from src.modules.assistant.application.use_cases.search_faq import SearchFaqUseCase
from src.modules.assistant.application.use_cases.upsert_faq_embeddings import FaqIn, UpsertFaqEmbeddingsUseCase
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.infrastructure.agents.guide_agent import GuideAgent
from src.modules.assistant.infrastructure.clients.faq_retriever import FaqRetriever
from src.modules.assistant.infrastructure.clients.manual_retriever import ManualRetriever
from src.modules.assistant.infrastructure.vector_stores.faiss_store import FaissStore
from tests.conftest import FakeLLMClient

_VOCAB = ["certificado", "pago", "contraseña", "examen"]


class BagEncoder:
    """Codificador determinista: un eje por palabra clave (sin descargar modelos)."""

    def get_sentence_embedding_dimension(self) -> int:
        return len(_VOCAB)

    def encode(self, texts: list[str], **_: object) -> np.ndarray:
        v = np.array([[float(w in t.lower()) for w in _VOCAB] for t in texts]) + 1e-6
        return v / np.linalg.norm(v, axis=1, keepdims=True)


MANUAL = ManualArticleIn(
    slug="estudiante",
    title="Manual del estudiante",
    role="USER",
    locale="es",
    body="# Manual del estudiante\nIntro.\n\n## Cómo pagar\nAbre el carrito y elige el pago con tarjeta.\n![captura](pago.png)\n\n## Mi certificado\nAl terminar el curso solicita el certificado en tu perfil.",
)
ADMIN_ONLY = ManualArticleIn(slug="admin", title="Manual del administrador", role="ADMIN", locale="es", body="## Revocar\nUn certificado se revoca desde Gestión.")


async def _agent(tmp_path, llm: FakeLLMClient) -> GuideAgent:
    faq_store, manual_store = FaissStore(BagEncoder(), tmp_path / "faq"), FaissStore(BagEncoder(), tmp_path / "manual")
    await UpsertFaqEmbeddingsUseCase(faq_store).execute(
        [FaqIn(id="f1", question="¿Cómo cambio mi contraseña?", answer="En Mi perfil → Seguridad.", category="cuenta", manual_slug="estudiante")]
    )
    await ReindexManualUseCase(manual_store).execute([MANUAL, ADMIN_ONLY])
    return GuideAgent(llm, SearchFaqUseCase(FaqRetriever(faq_store), 0.72), ManualRetriever(manual_store), 0.35)


def test_divide_el_articulo_por_secciones_con_ancla_y_sin_capturas() -> None:
    docs = split_sections(MANUAL)
    assert [d.id for d in docs] == ["estudiante", "estudiante#como-pagar", "estudiante#mi-certificado"]
    assert "captura" not in docs[1].source and docs[1].topic == "Cómo pagar"


async def test_faq_responde_sin_llm(tmp_path) -> None:
    llm = FakeLLMClient()
    r = await (await _agent(tmp_path, llm)).reply(Conversation("c", "u"), "olvidé la contraseña", context=ScreenContext("/profile", "USER"))
    assert (r.answered_by, r.text) == ("faq", "En Mi perfil → Seguridad.")
    assert r.sources[0].ref == "estudiante"
    assert llm.calls == []  # Deterministic-first: la FAQ basta


async def test_manual_con_citas_y_solo_del_rol(tmp_path) -> None:
    llm = FakeLLMClient(reply="1. Ve a tu perfil. 2. Pulsa «Solicitar» [1].")
    r = await (await _agent(tmp_path, llm)).reply(Conversation("c", "u"), "¿dónde está mi certificado?", context=ScreenContext("/courses", "USER"))
    assert r.answered_by == "llm" and r.sources[0].id == "estudiante#mi-certificado"
    prompt = llm.calls[0]["prompt"]
    assert "solicita el certificado" in prompt and "Pantalla actual: /courses" in prompt
    assert "Gestión" not in prompt  # La sección de ADMIN no llega a un estudiante


async def test_sin_coincidencias_o_no_se_dice_que_no_sabe(tmp_path) -> None:
    agent = await _agent(tmp_path, FakeLLMClient(reply="NO_SE"))
    assert (await agent.reply(Conversation("c", "u"), "¿cómo hago un examen?", context=ScreenContext(None, "USER"))).answered_by == "none"
    assert (await agent.reply(Conversation("c", "u"), "certificado", context=ScreenContext(None, "USER", "en"))).text.startswith("I could not find")


async def test_llm_caido_devuelve_la_seccion_verificada(tmp_path) -> None:
    class DownLLM(FakeLLMClient):
        async def generate(self, prompt: str, **kw: object) -> str:
            raise RuntimeError("Ollama caído")

    r = await (await _agent(tmp_path, DownLLM())).reply(Conversation("c", "u"), "pago", context=ScreenContext(None, "USER"))
    assert r.answered_by == "manual" and "carrito" in r.text
