"""[FACADE] construye el agente ReAct de LangGraph con Qwen2.5 (Ollama) + tools.

Import perezoso de langgraph/langchain-ollama: la app arranca aunque no estén
instalados; solo al usar el agente se exige la dependencia (con error claro).
"""

from typing import Any

from src.common.enums.blockchain_enum import ChainType
from src.config.settings import settings
from src.module.blockchain.agent.agent_prompt import get_agent_prompt


def create_blockchain_agent(chain: ChainType, tools: list[Any]) -> Any:
    """create_react_agent(Qwen2.5, tools, prompt) — un agente por cadena."""
    try:
        from langchain_ollama import ChatOllama
        from langgraph.prebuilt import create_react_agent
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "Faltan dependencias del agente: `poetry add langgraph langchain-ollama`"
        ) from exc

    llm = ChatOllama(
        base_url=settings.ollama_base_url,
        model=settings.blockchain_ai_model,
        temperature=0,  # determinismo para tool calling
    )
    return create_react_agent(llm, tools, prompt=get_agent_prompt(chain))
