"""Schema Pydantic v2 — request de POST /own-llm/correct y alcance del LLM propio.

[Patrón]: DTO inmutable + Lookup Table (alcance).
[Principio]: SSOT — el alcance (idiomas y niveles) vive solo aquí; lo leen el router, el dataset y la evaluación.
[Paradigma]: Declarativo.
"""

from typing import Literal, get_args  # `get_args` (typing): valores de un Literal → lista para GET /own-llm/scope

from pydantic import BaseModel, ConfigDict, Field

# [Alcance · RF-144]: los 7 idiomas de la plataforma y los 6 niveles MCER (mismos valores que packages/shared-schemas) | [Principio]: OCP
WritingLanguage = Literal["en", "fr", "de", "es", "pt", "zh", "ru"]
WritingLevel = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
# [Modelo propio]: idiomas con los que se ajustó (QLoRA) el corrector propio; el resto lo corrige el modelo base con el MISMO prompt
# Añadir un idioma aquí = incluir sus errores aprobados en el dataset (training/writing_corrector) y reentrenar
OWN_MODEL_LANGUAGES: tuple[str, ...] = ("en",)

SUPPORTED_LANGUAGES: tuple[str, ...] = get_args(WritingLanguage)
SUPPORTED_LEVELS: tuple[str, ...] = get_args(WritingLevel)
MAX_TEXT_LENGTH = 2000  # Redacciones cortas: más texto no cabe bien en el contexto de un modelo pequeño


class WritingRequest(BaseModel):
    """Redacción del estudiante a corregir."""

    model_config = ConfigDict(frozen=True, extra="forbid")  # Inmutable y sin campos desconocidos | [Principio]: Fail Fast

    text: str = Field(..., min_length=3, max_length=MAX_TEXT_LENGTH, description="Redacción del estudiante")
    language: WritingLanguage = "en"
    level: WritingLevel = "B1"  # Nivel MCER: ajusta qué se marca (en A1 no se corrige estilo avanzado)
