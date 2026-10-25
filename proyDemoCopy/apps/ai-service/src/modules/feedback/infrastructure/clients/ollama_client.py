"""OllamaClient — Adapter HTTP a un Ollama local (localhost:11434).

[Patron]: Adapter (Hexagonal).
[Principio]: DIP — implementa LLMClient sin que el dominio sepa de HTTP.
[Paradigma]: POO + asincrono.

[Fallback]: si Ollama no responde, generate() retorna texto canned (no levanta excepcion para no romper UX educativa).
"""
import logging

import httpx

from src.shared.config.settings import get_settings
from src.shared.exceptions.custom_errors import ModelInferenceError

logger = logging.getLogger("ai-service.ollama")


class OllamaClient:
    """Adapter sobre POST /api/generate de Ollama."""

    def __init__(self, timeout: float = 30.0) -> None:  # [Sprint 5.6]: el corrector de redacciones usa un timeout mayor
        s = get_settings()
        self._url = s.ollama_url.rstrip("/")
        self._model = s.ollama_model
        self._keep_alive = s.ollama_keep_alive
        # [Timeout corto para evitar bloqueo en UI]: si LLM tarda > 30s, fallback
        self._timeout = httpx.Timeout(timeout)

    async def generate(
        self,
        prompt: str,
        *,
        max_tokens: int = 512,
        temperature: float = 0.7,
        system: str | None = None,
        model: str | None = None,  # [Sprint 5.6]: otro modelo del mismo Ollama (p. ej. el LLM propio aula-corrector)
        json_mode: bool = False,  # `format: "json"` (Ollama): fuerza una salida JSON válida
        strict: bool = False,  # True → lanza ModelInferenceError en vez del texto de respaldo (lo usa la cadena de respaldo del LLM propio)
    ) -> str:
        payload = {
            "model": model or self._model,
            "prompt": prompt,
            "stream": False,
            # [keep_alive]: mismo criterio que el backend (carga bajo demanda + liberación)
            "keep_alive": self._keep_alive,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        if system:
            payload["system"] = system
        if json_mode:
            payload["format"] = "json"

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                res = await client.post(f"{self._url}/api/generate", json=payload)
                res.raise_for_status()
                data = res.json()
                return str(data.get("response", "")).strip()
        except (httpx.HTTPError, httpx.TimeoutException) as exc:
            if strict:  # [Sprint 5.6]: el llamador decide el respaldo (siguiente modelo de la cadena)
                raise ModelInferenceError(f"Ollama ({payload['model']}) no respondió: {exc}") from exc
            # [Fallback graceful]: no romper feedback si Ollama caido
            logger.warning("Ollama unavailable, returning fallback: %s", exc)
            return self._canned_fallback(prompt)

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                res = await client.get(f"{self._url}/api/tags")
                return res.status_code == 200
        except (httpx.HTTPError, httpx.TimeoutException):
            return False

    async def has_model(self, name: str) -> bool:
        """[Sprint 5.6]: ¿está registrado `name` en Ollama? (`aula-corrector` == `aula-corrector:latest`)."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                res = await client.get(f"{self._url}/api/tags")
                res.raise_for_status()
                tags = {m.get("name", "") for m in res.json().get("models", [])}
                return name in tags or f"{name}:latest" in tags
        except (httpx.HTTPError, httpx.TimeoutException, ValueError):
            return False

    @staticmethod
    def _canned_fallback(prompt: str) -> str:
        """Mensaje genérico cuando Ollama no está disponible."""
        return (
            "Revisa el concepto clave de la pregunta. "
            "Intenta descomponer el problema en pasos más pequeños y compara tu respuesta con la información que ya conoces sobre el tema."
        )
