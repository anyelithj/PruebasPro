# prompt_builder.py (Python) => arma la lista de mensajes que recibe el LLM: system prompt +
# contexto RAG numerado (5B.2) + ventana de historial + pregunta.
# Patrón: Builder (función que compone el prompt por partes).
# Paradigma: funcional (función pura: misma entrada => mismo prompt; fácil de probar y cacheable:
# el CachedProvider usa el prompt completo como clave).

from collections.abc import Sequence

from app.module.llm_assistant.ml.llm_provider import ChatMessage
from app.module.llm_assistant.ml.rag_retriever import Source

SYSTEM_PROMPT = (
    "Eres el asistente de una tienda en línea. Responde en el idioma del cliente, en máximo 4 "
    "frases. No inventes precios, stock ni estados de pedido: usa las herramientas disponibles "
    "o, si no las tienes, indica dónde consultarlos (Mi cuenta → Mis pedidos). Nunca pidas "
    "contraseñas, frases semilla ni firmas de billetera; no puedes ejecutar pagos ni "
    "transacciones."
)
CONTEXT_HEADER = (
    "\n\nUsa este contexto de la tienda si responde a la pregunta y cita la fuente con [n]. "
    "Si no alcanza, dilo:\n"
)


def build_prompt(
    history: list[ChatMessage], question: str, sources: Sequence[Source] = ()
) -> list[ChatMessage]:
    system = SYSTEM_PROMPT
    if sources:  # "enumerate(..., 1)" => numeración desde 1 para las citas [1], [2]...
        system += CONTEXT_HEADER + "\n".join(
            f"[{n}] {s.title}: {s.content}" for n, s in enumerate(sources, 1)
        )
    # "[a, *b, c]" => desempaqueta el historial entre el system prompt y la pregunta nueva
    return [
        {"role": "system", "content": system},
        *history,
        {"role": "user", "content": question},
    ]
