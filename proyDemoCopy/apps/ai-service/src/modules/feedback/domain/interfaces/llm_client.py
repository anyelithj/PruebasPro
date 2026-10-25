"""Port LLMClient — contrato hacia Ollama / OpenAI / cualquier proveedor.

[Patron]: Port (Hexagonal) + Strategy.
[Principio]: DIP + ISP.
[Paradigma]: POO + asincrono.
"""
from typing import Protocol


class LLMClient(Protocol):
    """Adapter generico de LLM."""

    async def generate(
        self,
        prompt: str,
        *,
        max_tokens: int = 512,
        temperature: float = 0.7,
        system: str | None = None,
        json_mode: bool = False,  # [Sprint 8.1]: salida JSON válida (Ollama `format: "json"`) → traducción, ejemplos y jugadas
    ) -> str:
        """Genera texto. Lanza ExternalServiceError si el LLM no responde."""
        ...

    async def is_available(self) -> bool:
        """Health-check ligero, sin generar texto."""
        ...
