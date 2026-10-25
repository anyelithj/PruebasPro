"""Schema Pydantic v2 — POST /level-classifier/classify.

[Patrón]: DTO inmutable.
[Principio]: Fail Fast (texto o turnos, con límites) + ISP.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.modules.language_tools.domain.language_voices import LanguageCode


class ClassifyRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    language: LanguageCode
    text: str | None = Field(None, max_length=20000)
    turns: list[str] = Field(default_factory=list, max_length=200)  # Diálogo: un elemento por turno (sin el nombre del hablante)

    @model_validator(mode="after")
    def _some_text(self) -> "ClassifyRequest":
        if not (self.text or "").strip() and not any(t.strip() for t in self.turns):
            raise ValueError("Envía el texto o los turnos del diálogo")
        return self

    @property
    def content(self) -> str:
        """Texto a medir: los turnos se unen como oraciones independientes."""
        return (self.text or "").strip() or ". ".join(t.strip().rstrip(".") for t in self.turns if t.strip()) + "."
