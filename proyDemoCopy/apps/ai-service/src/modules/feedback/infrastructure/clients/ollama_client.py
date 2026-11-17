"""OllamaClient — Adapter HTTP a un Ollama local (localhost:11434).

[Patron]: Adapter (Hexagonal).
[Principio]: DIP — implementa LLMClient sin que el dominio sepa de HTTP.
[Paradigma]: POO + asincrono.

[Fallback]: si Ollama no responde, generate() retorna texto canned (no levanta excepcion para no romper UX educativa).
"""
import logging
import re

import httpx

from src.shared.config.settings import get_settings
from src.shared.exceptions.custom_errors import ModelInferenceError

logger = logging.getLogger("ai-service.ollama")
# [2026-11-05]: mensajes de llama.cpp/Ollama cuando el modelo no cabe en RAM → se prueba el siguiente modelo más pequeño
_OOM = re.compile(r"bad_alloc|out[ -]of[ -]memory|failed to allocate|requires more system memory|not enough memory|cannot allocate", re.I)


class OllamaClient:
    """Adapter sobre POST /api/generate de Ollama."""

    def __init__(self, timeout: float = 30.0) -> None:  # [Sprint 5.6]: el corrector de redacciones usa un timeout mayor
        s = get_settings()
        self._url = s.ollama_url.rstrip("/")
        self._model = s.ollama_model
        self._keep_alive = s.ollama_keep_alive
        self._fallbacks = [m.strip() for m in s.ollama_fallback_models.split(",") if m.strip() and m.strip() != s.ollama_model]
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

        # Modelo explícito (p. ej. el LLM propio) → sin respaldo; el modelo por defecto → cadena de respaldo ante falta de RAM
        chain = [payload["model"]] if model else [payload["model"], *self._fallbacks]
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                for i, name in enumerate(chain):
                    payload["model"] = name
                    res = await client.post(f"{self._url}/api/generate", json=payload)
                    if res.status_code >= 500 and i + 1 < len(chain) and _OOM.search(res.text):
                        logger.warning("Ollama sin RAM para %s; se prueba %s", name, chain[i + 1])
                        continue
                    res.raise_for_status()
                    data = res.json()
                    return str(data.get("response", "")).strip()
                raise httpx.HTTPError("sin modelo disponible")
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
