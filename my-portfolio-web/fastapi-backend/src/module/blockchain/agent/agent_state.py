"""[CC-N] estado del agente ReAct — mensajes + tool calls + cadena activa.

TypedDict sin dependencias externas: solo documenta la forma del estado que
LangGraph gestiona internamente en create_react_agent.
"""

from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    messages: list[Any]      # Historial de la conversación ReAct.
    tool_calls: list[str]    # Nombres de las tools invocadas en el turno.
    chain: str               # "solana" | "ethereum".
