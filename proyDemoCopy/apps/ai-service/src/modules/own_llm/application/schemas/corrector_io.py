"""Contrato del corrector pedagógico (Anexo A): entrada, salida JSON estricta y respuesta HTTP con trazabilidad.

La SALIDA del modelo es exactamente la del Anexo A (sin campos adicionales: `extra="forbid"`); la respuesta HTTP la ENVUELVE con
puntuación, modelo, versión del prompt y latencia (RNF-35) sin tocar sus campos.
[Patrón]: DTO inmutable (Pydantic v2 frozen) + Specification (validadores de coherencia) | [Principio]: SSOT del contrato + Fail Fast
[Paradigma]: Declarativo.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator  # Pydantic v2: validación en la frontera

from src.modules.own_llm.application.schemas.writing_request import WritingLanguage, WritingLevel

TextKind = Literal["frase", "titulo", "expresion"]  # tipo_de_texto
Origin = Literal["voz", "escrito"]  # origen
Verdict = Literal["correcta", "con_errores", "no_responde"]  # veredicto
Category = Literal["ortografia", "mayuscula", "puntuacion", "gramatica", "vocabulario", "no_responde_a_la_pregunta", "posible_error_de_transcripcion"]
AlternativeKind = Literal["literal", "natural", "cercana"]

_STRICT = ConfigDict(frozen=True, extra="forbid")  # Inmutable y sin campos desconocidos (Anexo A: «sin campos adicionales»)


class CorrectorInput(BaseModel):
    """ENTRADA del Anexo A."""

    model_config = _STRICT
    pregunta_previa: str = Field(default="", max_length=400)  # Pregunta del avatar/ejercicio a la que responde
    texto: str = Field(..., min_length=1, max_length=2000)
    idioma: WritingLanguage = "en"  # Los 7 idiomas de la plataforma
    nivel: WritingLevel = "A1"
    tema: str = Field(default="", max_length=200)
    tipo_de_texto: TextKind = "frase"
    origen: Origin = "escrito"
    # [Tarea 6/9 · Anexo A]: fragmentos de material revisado recuperados por el RAG (opcional, máximo 5); vacío = el modelo no recibe el campo
    referencias: list[Annotated[str, Field(min_length=1, max_length=1500)]] = Field(default_factory=list, max_length=5)


class CorrectorError(BaseModel):
    model_config = _STRICT
    categoria: Category
    original: str = Field(..., min_length=1, max_length=300)
    sugerencia: str = Field(..., max_length=300)
    explicacion: str = Field(..., min_length=1, max_length=600)


class TranslationAlternative(BaseModel):
    model_config = _STRICT
    tipo: AlternativeKind
    texto: str = Field(..., min_length=1, max_length=400)


class CorrectorOutput(BaseModel):
    """SALIDA del Anexo A (un único objeto JSON)."""

    model_config = _STRICT
    frase_corregida: str = Field(..., min_length=1, max_length=2000)
    veredicto: Verdict
    errores: list[CorrectorError] = Field(default_factory=list, max_length=20)
    traduccion: str = Field(default="", max_length=2000)
    alternativas_traduccion: list[TranslationAlternative] = Field(default_factory=list, max_length=3)
    comentario: str = Field(default="", max_length=300)

    # `@model_validator(mode="after")` (Pydantic v2): reglas que cruzan campos | Anexo A regla 5
    @model_validator(mode="after")
    def _coherente(self) -> "CorrectorOutput":
        if self.veredicto == "correcta" and self.errores:
            raise ValueError("veredicto «correcta» con errores: incoherente (regla 5)")
        if self.veredicto == "con_errores" and not self.errores:
            raise ValueError("veredicto «con_errores» sin errores: incoherente")
        if len({a.tipo for a in self.alternativas_traduccion}) != len(self.alternativas_traduccion):  # `set` (stdlib): sin tipos repetidos
            raise ValueError("alternativas_traduccion con tipos repetidos")
        return self


class CorrectorResponse(BaseModel):
    """Respuesta HTTP: la corrección del Anexo A + lo que la UI y la trazabilidad necesitan (sin alterar la corrección)."""

    model_config = ConfigDict(frozen=True)
    correccion: CorrectorOutput
    puntuacion: int = Field(..., ge=0, le=100, description="100 solo si el veredicto es «correcta»")
    modelo: str  # Modelo que respondió o «reglas» si el LLM no estaba disponible
    respaldo: bool  # True = no respondió el primer modelo de la cadena (o solo reglas)
    version_prompt: str  # RNF-35: versión del prompt del Anexo A
    referencias_usadas: list[str] = Field(default_factory=list)  # RNF-35 · Tarea 9: ids de los fragmentos del RAG que recibió el modelo
    latencia_ms: int
