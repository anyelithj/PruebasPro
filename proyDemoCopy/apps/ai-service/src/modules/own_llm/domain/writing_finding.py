"""Value Object WritingFinding — hallazgo del Corrector de redacciones (ErrorFinding + categoría «Mayúsculas»).

[Fix 2026-10-28 · Estilo GrammarMama]: las explicaciones distinguen Ortografía, Mayúsculas, Gramática, Puntuación, Vocabulario, Orden y Estilo
(«ana → Ana · Mayúsculas · Los nombres propios se escriben con mayúscula inicial»).
[Patrón]: Value Object inmutable (Pydantic frozen) + herencia (Liskov: un WritingFinding sirve donde se espera un ErrorFinding).
[Principio]: OCP — la categoría nueva vive SOLO en OwnLlm; el ErrorType compartido con Grading (y las UIs de Práctica que lo validan) no cambia.
[Paradigma]: Declarativo.
"""

from enum import Enum  # `Enum` (stdlib): conjunto cerrado de valores

from pydantic import Field, field_validator  # Pydantic v2: validación en la frontera

from src.shared.domain.error_finding import ErrorFinding


class WritingErrorType(str, Enum):  # `str, Enum`: se serializa como texto y compara igual que ErrorType con el mismo valor
    """Categoría pedagógica del error en una redacción (la UI la traduce: «Ortografía», «Mayúsculas»…)."""

    GRAMMAR = "grammar"  # Gramática: concordancia, tiempos verbales, artículos…
    VOCABULARY = "vocabulary"  # Vocabulario: palabra incorrecta o falso amigo
    SPELLING = "spelling"  # Ortografía: letras, tildes, apóstrofos de contracción («i m» → «I'm»)
    CAPITALIZATION = "capitalization"  # [2026-10-28]: Mayúsculas (nombres propios, inicio de oración, «I»)
    PUNCTUATION = "punctuation"  # Puntuación: comas, puntos, signos
    WORD_ORDER = "word_order"  # Orden de palabras
    STYLE = "style"  # Estilo: registro o naturalidad
    ARTICLE = "article"  # [2026-11-02]: Artículo («I'm teacher» → «I'm a teacher»), como GrammarMama
    TRANSCRIPTION = "transcription"  # [2026-11-13 · Anexo A «posible_error_de_transcripcion»]: palabra mal reconocida por el dictado de voz (no es falta del estudiante)


# [Sinónimos]: lo que los modelos pequeños escriben a veces en `type` → categoría canónica | [Patrón]: Lookup Table
_ALIASES = {
    "capitalisation": WritingErrorType.CAPITALIZATION,
    "capital_letters": WritingErrorType.CAPITALIZATION,
    "uppercase": WritingErrorType.CAPITALIZATION,
    "case": WritingErrorType.CAPITALIZATION,
    "mayúsculas": WritingErrorType.CAPITALIZATION,
    "mayusculas": WritingErrorType.CAPITALIZATION,
    "orthography": WritingErrorType.SPELLING,
    "ortografía": WritingErrorType.SPELLING,
    "word_choice": WritingErrorType.VOCABULARY,
    "articles": WritingErrorType.ARTICLE,
    "artículo": WritingErrorType.ARTICLE,
    "posible_error_de_transcripcion": WritingErrorType.TRANSCRIPTION,  # Categoría del Anexo A
    "speech_recognition": WritingErrorType.TRANSCRIPTION,
}


class WritingFinding(ErrorFinding):
    """Hallazgo de redacción: fragmento original, corrección, categoría y explicación en español."""

    type: WritingErrorType = Field(default=WritingErrorType.GRAMMAR)  # type: ignore[assignment]  # Amplía el Enum del padre (sin romper Grading)

    # `@field_validator(mode="before")` (Pydantic v2): mismo nombre que en el padre → lo SUSTITUYE (override) | tolera «Capitalization», «grammar|spelling»…
    @field_validator("type", mode="before")
    @classmethod
    def _coerce_type(cls, value: object) -> WritingErrorType:  # type: ignore[override]
        raw = value.value if isinstance(value, Enum) else value  # ErrorType del diff o de los tests → su texto
        token = str(raw or "").strip().lower().replace(" ", "_").replace("-", "_").split("|")[0]
        if token in WritingErrorType._value2member_map_:
            return WritingErrorType(token)
        return _ALIASES.get(token, WritingErrorType.GRAMMAR)  # Desconocido → gramática
