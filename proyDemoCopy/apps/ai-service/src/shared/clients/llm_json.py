"""Helper compartido: pedir JSON al LLM y degradar sin romper la petición.

[Patrón]: Template Method funcional (prompt → JSON → dict) + Null Object (None si falla).
[Principio]: DRY (lo usan LanguageTools, Assistant/juegos y Grading/práctica) + determinístico primero (el llamador decide el respaldo).
[Paradigma]: Funcional + asíncrono.
"""

import json
import logging
from typing import Any

from src.modules.feedback.domain.interfaces.llm_client import LLMClient

logger = logging.getLogger("ai-service.llm-json")


async def generate_json(
    llm: LLMClient, prompt: str, *, system: str, max_tokens: int = 300, temperature: float = 0.2
) -> dict[str, Any] | None:
    """Devuelve el objeto JSON del LLM o None (LLM caído, texto de respaldo o JSON inválido)."""
    try:
        raw = await llm.generate(prompt, system=system, max_tokens=max_tokens, temperature=temperature, json_mode=True)
        data = json.loads(raw)
        return data if isinstance(data, dict) else None  # `isinstance`: el contrato es un objeto, no una lista
    except Exception as exc:  # noqa: BLE001 — cualquier fallo del LLM degrada a None (el IPA y los motores deterministas siguen)
        logger.warning("LLM sin JSON válido: %s", exc)
        return None
