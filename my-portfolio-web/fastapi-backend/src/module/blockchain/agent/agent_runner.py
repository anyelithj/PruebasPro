"""[FACADE][DRY] ejecuta el agente ReAct y normaliza sus eventos.

Compartido por Solana y Ethereum (DRY): ambos servicios solo construyen su agente
con sus tools y delegan aquí el streaming (astream_events) y la invocación unaria.
"""

import json
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any


async def stream_agent_events(
    agent: Any, message: str
) -> AsyncGenerator[dict[str, Any], None]:
    """Emite eventos normalizados del agente: chunk / tool_call / tool_result / done.

    Espeja el flujo de LangGraph astream_events(version="v2").
    """
    async for event in agent.astream_events(
        {"messages": [("human", message)]}, version="v2"
    ):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            chunk = event["data"]["chunk"].content
            if chunk:
                yield {"type": "chunk", "content": chunk}
        elif kind == "on_tool_start":
            yield {"type": "tool_call", "tool": event["name"]}
        elif kind == "on_tool_end":
            result = event["data"].get("output", {})
            yield {"type": "tool_result", "tool": event["name"], "result": _safe(result)}
    yield {"type": "done"}


async def invoke_agent(agent: Any, message: str) -> dict[str, Any]:
    """Ejecución unaria — devuelve el JSON estructurado estándar (para gRPC → NestJS)."""
    tool_used = ""
    tool_result: Any = None
    async for event in stream_agent_events(agent, message):
        if event["type"] == "tool_result":
            tool_used = event.get("tool", "")
            tool_result = event.get("result")
    final = await agent.ainvoke({"messages": [("human", message)]})
    agent_response = ""
    messages = final.get("messages", []) if isinstance(final, dict) else []
    if messages:
        agent_response = getattr(messages[-1], "content", "") or ""
    return {
        "status": "success",
        "tool_used": tool_used,
        "agent_response": agent_response,
        "tool_result": tool_result,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def _safe(value: Any) -> Any:
    """Convierte el output de la tool a algo serializable en JSON."""
    if isinstance(value, (dict, list, str, int, float, bool)) or value is None:
        return value
    content = getattr(value, "content", None)
    if content is not None:
        try:
            return json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return content
    return str(value)
