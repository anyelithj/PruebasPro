"""Schemas Pydantic v2 — POST /language-tools/detect (idioma de un texto, sin LLM).

[Patrón]: DTO inmutable.
[Principio]: Fail Fast + ISP (solo lo que necesita «Detectar idioma»).
[Paradigma]: Declarativo.
[2026-10-27]: Traductor y Corrector de redacciones con «Detectar idioma» por defecto.
"""

from pydantic import BaseModel, ConfigDict, Field

from src.modules.language_tools.domain.language_voices import LanguageCode


class DetectRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    text: str = Field(..., min_length=1, max_length=5000)


class DetectResponse(BaseModel):
    language: LanguageCode
    confidence: float = Field(..., ge=0, le=1)  # Heurística: < 0.5 → la UI puede sugerir elegir el idioma a mano
    method: str  # script | markers | langdetect | default (trazabilidad)
