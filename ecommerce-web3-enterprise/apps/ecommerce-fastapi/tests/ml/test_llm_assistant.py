# test_llm_assistant.py (pytest) => Fase 5B: gateway (fallback), RAG (chunking + prompt), tool use
# (registro, ejecutor con JWT, auditoría), guardrails, streaming SSE, paginación por cursor y
# métricas de evaluación. Proveedor, repositorio y Express falsos: sin Ollama, BD ni red.

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest

from app.module.llm_assistant.exception.llm_exception import (
    GuardrailViolationError,
    LlmProviderError,
)
from app.module.llm_assistant.ml import llm_evaluator
from app.module.llm_assistant.ml.guardrails import guard_input, guard_output
from app.module.llm_assistant.ml.knowledge_indexer import chunk_text
from app.module.llm_assistant.ml.llm_provider import (
    ChatMessage,
    FallbackProvider,
    LlmProvider,
    ToolRequest,
)
from app.module.llm_assistant.ml.ollama_provider import needs_strong_model
from app.module.llm_assistant.ml.prompt_builder import SYSTEM_PROMPT, build_prompt
from app.module.llm_assistant.ml.rag_retriever import Source
from app.module.llm_assistant.ml.tool_executor import ToolExecutor
from app.module.llm_assistant.service import llm_service
from app.module.llm_assistant.service.llm_service import LlmService, Turn
from app.shared.middleware.auth_middleware import AuthUser

USER = AuthUser(id="u1", email="a@b.co", roles=("CUSTOMER",), token="jwt-u1")
ORDER_ID = "0b6f1f3e-5d7a-4c1e-9a43-2f0d6c1b7a10"


class FakeProvider(LlmProvider):
    # "scripts" => lo que emite cada llamada sucesiva a stream (1.ª: puede pedir herramientas)
    def __init__(self, *scripts: list, fail: bool = False, name: str = "fake") -> None:
        self.scripts, self.fail, self.name, self.calls = list(scripts), fail, name, []

    async def stream(self, messages: list[ChatMessage], tools=None) -> AsyncIterator:
        self.calls.append((messages, tools))
        for part in self.scripts.pop(0) if self.scripts else []:
            yield part
        if self.fail:
            raise LlmProviderError()


class FakeRepository:
    def __init__(self, conversations: list | None = None) -> None:
        self.saved: list = []
        self.conversations = conversations or []

    async def add_message(self, message):
        message.id = f"m{len(self.saved)}"
        self.saved.append(message)
        return message

    async def save(self, *instances) -> None:
        self.saved.extend(instances)

    async def commit(self) -> None: ...

    async def list_by_user(self, user_id, before, limit):
        rows = [c for c in self.conversations if before is None or c.updated_at < before]
        return rows[:limit]


class FakeTools:
    def __init__(self) -> None:
        self.requests: list[ToolRequest] = []

    async def execute(self, user, conversation_id, request):
        self.requests.append(request)
        return '{"status": "SHIPPED"}', SimpleNamespace(message_id=None, tool=request.name)


@pytest.fixture(autouse=True)
def no_redis(monkeypatch: pytest.MonkeyPatch) -> list:
    calls: list = []

    async def append(key, *messages):
        calls.append((key, messages))

    monkeypatch.setattr(llm_service.context_manager, "append", append)
    return calls


def _service(provider: LlmProvider, repository=None, tools=None) -> LlmService:
    return LlmService(repository or FakeRepository(), lambda *_, **__: provider, tools)


def _turn(question: str = "hola", sources: list[Source] | None = None) -> Turn:
    return Turn(USER, "c1", question, build_prompt([], question, sources or []), sources or [])


def _events(raw: list[str]) -> list[tuple[str, dict]]:
    parsed = []
    for block in raw:
        event, data = block.strip().split("\n")
        parsed.append((event.removeprefix("event: "), json.loads(data.removeprefix("data: "))))
    return parsed


def _reply(service: LlmService, turn: Turn) -> list[tuple[str, dict]]:
    async def collect() -> list[str]:
        return [chunk async for chunk in service.reply(turn)]

    return _events(asyncio.run(collect()))


# ---------- Prompt y RAG ----------
def test_build_prompt_orders_system_history_question() -> None:
    prompt = build_prompt([{"role": "user", "content": "hola"}], "¿envían a Bogotá?")
    assert prompt[0] == {"role": "system", "content": SYSTEM_PROMPT}
    assert [m["role"] for m in prompt] == ["system", "user", "user"]


def test_build_prompt_numbers_rag_sources() -> None:
    sources = [Source("k1", "faq", "Envíos", "1 a 3 días", 0.9)]
    system = build_prompt([], "¿cuánto tarda?", sources)[0]["content"]
    assert system.startswith(SYSTEM_PROMPT) and "[1] Envíos: 1 a 3 días" in system


def test_chunk_text_respects_size_and_overlaps() -> None:
    text = " ".join(f"palabra{i}" for i in range(200))
    chunks = chunk_text(text, size=120, overlap=30)
    assert len(chunks) > 1 and all(len(c) <= 120 for c in chunks)
    assert chunks[0].split()[-1] in chunks[1]  # La última palabra se repite (solapamiento)
    assert chunks[-1].endswith("palabra199")
    assert chunk_text("corto") == ["corto"]


# ---------- Streaming SSE (5B.4) ----------
def test_reply_streams_tokens_saves_answer_and_sources(no_redis: list) -> None:
    repository = FakeRepository()
    sources = [Source("k1", "faq", "Envíos", "1 a 3 días", 0.9)]
    service = _service(FakeProvider(["Hola", ", ¿en qué", " ayudo?"]), repository)
    events = _reply(service, _turn("hola", sources))
    assert [e for e, _ in events] == ["token", "token", "token", "done"]
    assert events[-1][1]["message_id"] == "m0"
    saved = repository.saved[0]
    assert (saved.role, saved.content, saved.model) == ("assistant", "Hola, ¿en qué ayudo?", "fake")
    assert saved.sources == [{"id": "k1", "source": "faq", "title": "Envíos", "score": 0.9}]
    assert no_redis[0][0] == "llm:c1" and no_redis[0][1][0]["content"] == "hola"


def test_reply_emits_error_event_and_saves_nothing(no_redis: list) -> None:
    repository = FakeRepository()
    events = _reply(_service(FakeProvider(["Ho"], fail=True), repository), _turn())
    assert [e for e, _ in events] == ["token", "error"]
    assert events[-1][1]["code"] == "LLM_UNAVAILABLE"
    assert repository.saved == [] and no_redis == []


def test_reply_runs_one_tool_round_and_links_audit() -> None:
    repository, tools = FakeRepository(), FakeTools()
    provider = FakeProvider(
        [ToolRequest("get_order_status", {"order_id": ORDER_ID})], ["Tu pedido va ", "en camino."]
    )
    events = _reply(_service(provider, repository, tools), _turn("¿mi pedido?"))
    assert [e for e, _ in events] == ["tool", "token", "token", "done"]
    assert tools.requests[0].name == "get_order_status"
    first_tools, (second_messages, second_tools) = provider.calls[0][1], provider.calls[1]
    assert first_tools and second_tools is None  # 2.ª llamada sin herramientas: termina siempre
    assert second_messages[-1] == {
        "role": "tool",
        "content": '{"status": "SHIPPED"}',
        "tool_name": "get_order_status",
    }
    answer, audit = repository.saved
    assert answer.content == "Tu pedido va en camino." and audit.message_id == answer.id


def test_reply_redacts_pii_in_saved_answer() -> None:
    repository = FakeRepository()
    _reply(_service(FakeProvider(["Escribe a soporte@tienda.co"]), repository), _turn())
    assert repository.saved[0].content == "Escribe a [correo]"


def test_list_returns_next_cursor_only_when_more_rows() -> None:
    now = datetime.now(UTC)
    rows = [SimpleNamespace(updated_at=now - timedelta(minutes=i)) for i in range(3)]
    service = _service(FakeProvider(), FakeRepository(rows))
    page, cursor = asyncio.run(service.list_page(USER, None, 2))
    assert len(page) == 2 and cursor == rows[1].updated_at
    page, cursor = asyncio.run(service.list_page(USER, cursor, 2))
    assert len(page) == 1 and cursor is None


# ---------- Gateway (5B.1) ----------
async def _drain(provider: LlmProvider) -> list:
    return [part async for part in provider.stream([])]


def test_fallback_uses_next_model_when_first_fails_before_emitting() -> None:
    broken, backup = FakeProvider(fail=True, name="strong"), FakeProvider(["ok"], name="small")
    gateway = FallbackProvider([broken, backup], retries=1)
    assert asyncio.run(_drain(gateway)) == ["ok"]
    assert len(broken.calls) == 2 and gateway.name == "small"  # 1 intento + 1 reintento


def test_fallback_does_not_retry_after_partial_answer() -> None:
    gateway = FallbackProvider([FakeProvider(["Ho"], fail=True), FakeProvider(["x"])], retries=1)
    with pytest.raises(LlmProviderError):
        asyncio.run(_drain(gateway))


def test_strong_model_routing_heuristic() -> None:
    assert not needs_strong_model("¿tienen tenis rojos?")
    assert needs_strong_model("compara el reloj A con el B")
    assert needs_strong_model("x" * 401)


# ---------- Guardrails (5B.3) ----------
def test_guard_input_blocks_wallet_secrets() -> None:
    with pytest.raises(GuardrailViolationError):
        guard_input("mi clave es 0x" + "a" * 64)
    seed = " ".join(["abandon"] * 11 + ["about"])
    with pytest.raises(GuardrailViolationError):
        guard_input(f"esta es mi frase semilla: {seed}")
    assert guard_input("mi billetera es 0x" + "b" * 40)  # Dirección pública: permitida


def test_guard_redacts_pii_but_keeps_order_numbers() -> None:
    text = guard_input(
        "tarjeta 4111 1111 1111 1111, cel +57 300 123 4567, pedido ORD-20261004-0001"
    )
    assert "[tarjeta]" in text and "[teléfono]" in text and "ORD-20261004-0001" in text
    assert guard_output("clave " + "c" * 64) == "clave [dato oculto]"


# ---------- Tool executor (5B.3) ----------
def _executor(handler) -> ToolExecutor:
    return ToolExecutor(
        httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://x")
    )


def test_tool_executor_propagates_user_jwt_and_summarizes() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer jwt-u1"
        assert request.url.path == f"/api/v1/order/{ORDER_ID}"
        order = {
            "orderNumber": "ORD-1",
            "status": "SHIPPED",
            "totalCents": 150000,
            "currency": "COP",
            "itemCount": 2,
            "placedAt": "2026-10-01",
            "userId": "u1",
        }
        return httpx.Response(200, json={"success": True, "data": order})

    request = ToolRequest("get_order_status", {"order_id": ORDER_ID})
    result, audit = asyncio.run(_executor(handler).execute(USER, "c1", request))
    assert json.loads(result)["status"] == "SHIPPED" and "userId" not in result
    assert (audit.status, audit.http_status, audit.user_id) == ("ok", 200, "u1")


def test_tool_executor_audits_denied_and_rejected_calls() -> None:
    executor = _executor(lambda _: httpx.Response(403, json={"success": False}))
    denied = ToolRequest("get_order_status", {"order_id": ORDER_ID})
    _, audit = asyncio.run(executor.execute(USER, "c1", denied))
    assert audit.status == "denied"
    for bad in (
        ToolRequest("transfer_funds", {}),
        ToolRequest("get_order_status", {"order_id": "1"}),
    ):
        result, audit = asyncio.run(executor.execute(USER, "c1", bad))
        assert audit.status == "rejected" and audit.http_status is None


# ---------- Evaluación (5B.5) ----------
def test_evaluation_metrics() -> None:
    assert llm_evaluator.faithfulness("envío gratis desde 150000", "envío gratis desde 150000") == 1
    assert llm_evaluator.faithfulness("cohete marciano", "envío gratis") == 0
    assert llm_evaluator.keyword_recall("Tienes 30 días", ["30"]) == 1
    assert llm_evaluator.p95([10, 20, 30, 40]) == 40


def test_evaluate_runs_set_and_summarizes() -> None:
    async def retrieve(question: str, lang: str) -> list[Source]:
        return [Source("k1", "policy", "Devoluciones", "Tienes 30 días para devolver", 0.9)]

    items = [{"question": "¿plazo de devolución?", "lang": "es", "keywords": ["30"]}]
    results = asyncio.run(llm_evaluator.evaluate(FakeProvider(["Tienes 30 días"]), retrieve, items))
    summary = llm_evaluator.summarize(results)
    assert summary["questions"] == 1 and summary["keyword_recall"] == 1
    assert summary["hallucination_rate"] == 0 and summary["est_tokens"] > 0
