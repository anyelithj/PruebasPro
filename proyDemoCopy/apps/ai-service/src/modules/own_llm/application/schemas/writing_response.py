"""Schemas Pydantic v2 — respuestas del LLM propio (corrección, alcance y ficha del modelo).

[Patrón]: DTO inmutable.
[Principio]: SRP + ISP — una forma por endpoint; CorrectionDraft es el contrato JSON que debe devolver el modelo.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.modules.own_llm.domain.writing_finding import WritingFinding  # [2026-10-28]: ErrorFinding (DRY con Grading) + categoría «Mayúsculas»


class CorrectionDraft(BaseModel):
    """Salida JSON del modelo (lo que se le pide en el prompt y lo que aprende en el ajuste fino)."""

    model_config = ConfigDict(frozen=True, extra="ignore")

    findings: list[WritingFinding] = Field(default_factory=list, max_length=40)
    corrected_text: str = Field(..., min_length=1, max_length=4000)
    explanation_es: str = Field(default="", max_length=1500, description="Resumen pedagógico en español")

    # [2026-10-28]: un ErrorFinding compartido (diff, tests) no es instancia de WritingFinding → se revalida desde su dict
    # `mode="before"` (Pydantic v2): corre antes de validar la lista | `model_dump()` (Pydantic v2): modelo → dict
    @field_validator("findings", mode="before")
    @classmethod
    def _as_dicts(cls, value: object) -> object:
        return [f.model_dump() if isinstance(f, BaseModel) else f for f in value] if isinstance(value, list) else value


class WritingResponse(CorrectionDraft):
    """Corrección + trazabilidad (qué modelo respondió y si se usó el respaldo)."""

    model_used: str = Field(..., description="Modelo de Ollama que produjo la corrección")
    fallback_used: bool = Field(..., description="True si el LLM propio falló y respondió el modelo base")
    latency_ms: int = Field(..., ge=0)
    # [Especificación]: el contenido de IA nunca se presenta como verificado
    flags: list[str] = Field(default_factory=lambda: ["REQUIERE_REVISION"])
    language: str = Field(default="en", description="Idioma con el que se corrigió (el detectado si se pidió «auto»)")
    detected_language: str | None = Field(default=None, description="[2026-10-27]: idioma detectado cuando language=«auto»")


class ScopeResponse(BaseModel):
    """Alcance del corrector (la UI solo ofrece estos idiomas y niveles)."""

    languages: list[str]
    levels: list[str]
    max_text_length: int


class ModelCardResponse(BaseModel):
    """Ficha del modelo publicado: versión, cuantización y métricas de la última evaluación (run_eval.py)."""

    name: str  # Nombre en Ollama (OLLAMA_CORRECTOR_MODEL)
    base_model: str  # Respaldo cuando el propio no está o falla
    published: bool  # ¿Está registrado en Ollama ahora mismo?
    version: str | None = None
    quantization: str | None = None
    evaluated_at: str | None = None
    metrics: dict[str, float] = Field(default_factory=dict)
    gates: dict[str, bool] = Field(default_factory=dict)  # Umbrales de calidad superados o no
