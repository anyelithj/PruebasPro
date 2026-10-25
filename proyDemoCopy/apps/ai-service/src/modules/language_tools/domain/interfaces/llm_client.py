"""Puerto del LLM para LanguageTools.

[Patrón]: Port (Hexagonal) — alias del contrato LLMClient del módulo Feedback.
[Principio]: DRY (un solo contrato y un solo cliente de Ollama en el servicio) + DIP.
[Paradigma]: POO estructural (`Protocol`).
[Uso · Sprint 8.1]: solo traducción y ejemplos; el IPA nunca sale del LLM.
"""

from src.modules.feedback.domain.interfaces.llm_client import LLMClient

LlmPort = LLMClient  # Alias de tipo (PEP 613 implícito): LanguageTools depende del puerto, no de OllamaClient
