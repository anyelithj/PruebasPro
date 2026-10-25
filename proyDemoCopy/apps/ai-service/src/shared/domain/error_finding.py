"""Value Object ErrorFinding — un error marcado dentro de un texto del estudiante.

[Patrón]: Value Object inmutable (Pydantic frozen).
[Principio]: DRY — lo comparten Grading (marcar errores) y OwnLlm (corrector de redacciones); SSOT del formato.
[Paradigma]: Declarativo.
"""

from enum import Enum  # `Enum` (stdlib): conjunto cerrado de valores

from pydantic import BaseModel, ConfigDict, Field, field_validator  # Pydantic v2: validación en la frontera


class ErrorType(str, Enum):  # `str, Enum`: se serializa como texto en JSON
    """Categoría pedagógica del error (la UI la usa para colorear el marcado)."""

    GRAMMAR = "grammar"  # Concordancia, tiempos verbales, artículos…
    VOCABULARY = "vocabulary"  # Palabra incorrecta o falso amigo
    SPELLING = "spelling"  # Ortografía
    PUNCTUATION = "punctuation"  # Puntuación y mayúsculas
    WORD_ORDER = "word_order"  # Orden de palabras
    STYLE = "style"  # Registro o naturalidad (no es un error gramatical)


class ErrorFinding(BaseModel):
    """Hallazgo: qué fragmento está mal, cómo se corrige y por qué (en español)."""

    model_config = ConfigDict(frozen=True, extra="ignore")  # Inmutable; `extra="ignore"`: tolera campos de más que añada un LLM

    type: ErrorType = Field(default=ErrorType.GRAMMAR)
    original: str = Field(..., min_length=1, max_length=300, description="Fragmento tal como lo escribió el estudiante")
    correction: str = Field(..., max_length=300, description="Forma correcta del fragmento")
    explanation_es: str = Field(..., min_length=1, max_length=600, description="Por qué es un error, en español")
    # [Posición]: índices sobre el texto original [start, end) → los calcula el servidor, nunca el LLM (los modelos cuentan mal)
    start: int | None = Field(default=None, ge=0)
    end: int | None = Field(default=None, ge=0)

    # `@field_validator(mode="before")` (Pydantic v2): normaliza antes de validar → "Grammar", "grammar|spelling" o "verb tense" no tumban la corrección entera
    @field_validator("type", mode="before")
    @classmethod
    def _coerce_type(cls, value: object) -> ErrorType:
        if isinstance(value, ErrorType):  # [Sprint 8.13]: ya es el enum (lo pasan los evaluadores) → `str()` daría «ErrorType.X»
            return value
        token = str(value or "").strip().lower().replace(" ", "_").split("|")[0]
        return ErrorType(token) if token in ErrorType._value2member_map_ else ErrorType.GRAMMAR  # Desconocido → gramática
