"""Schemas Pydantic v2 — respuestas de GET /speech/models y GET /speech/status.

[Patrón]: DTO.
[Principio]: contrato explícito en Swagger (antes `dict` opaco).
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel  # `BaseModel` (Pydantic v2): valida la salida y genera el JSON Schema


class InstalledModelOut(BaseModel):
    name: str  # p. ej. «small», «medium»
    size_mb: float  # Tamaño en disco (MB, 1 decimal)


class SpeechModelsResponse(BaseModel):
    active: str  # Modelo configurado (WHISPER_MODEL)
    compute_type: str  # int8 · float16 …
    installed: list[InstalledModelOut]  # Modelos presentes en la caché de Hugging Face


class SpeechStatusResponse(BaseModel):
    """Espejo del Value Object `SpeechEngineStatus` (dataclass) para OpenAPI."""

    available: bool
    engine: str
    model: str
    compute_type: str
    reason: str | None = None  # `str | None` (PEP 604): opcional · causa técnica si no carga
    hint: str | None = None  # Qué hacer para arreglarlo
