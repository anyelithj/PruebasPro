"""Caso de uso: ficha del LLM propio (versión, cuantización y métricas de la última evaluación).

[Patrón]: Query (CQRS-lite) — solo lectura.
[Principio]: SRP + SSOT — las métricas las escribe run_eval.py en un JSON; aquí solo se leen.
[Paradigma]: POO + asíncrono.
"""

import json
from pathlib import Path  # stdlib: rutas multiplataforma

from src.modules.feedback.infrastructure.clients.ollama_client import OllamaClient
from src.modules.own_llm.application.schemas.writing_response import ModelCardResponse


class GetModelCardUseCase:
    def __init__(self, llm: OllamaClient, name: str, base_model: str, card_path: str) -> None:
        self._llm, self._name, self._base, self._path = llm, name, base_model, Path(card_path)

    async def execute(self) -> ModelCardResponse:
        card: dict = {}
        if self._path.is_file():  # Sin evaluación previa → ficha mínima (el modelo aún no se ha entrenado o evaluado)
            card = json.loads(self._path.read_text(encoding="utf-8"))
        return ModelCardResponse(
            name=self._name,
            base_model=self._base,
            published=await self._llm.has_model(self._name),
            version=card.get("version"),
            quantization=card.get("quantization"),
            evaluated_at=card.get("evaluated_at"),
            metrics=card.get("metrics", {}),
            gates=card.get("gates", {}),
        )
