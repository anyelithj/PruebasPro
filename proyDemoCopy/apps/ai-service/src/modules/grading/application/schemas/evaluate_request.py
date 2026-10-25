"""Schema Pydantic v2 — POST /grading/practice (un ítem de práctica + la respuesta del estudiante).

[Patrón]: DTO inmutable.
[Principio]: Fail Fast + ISP — cada evaluador (Strategy) interpreta `answer` y `accepted` según su tipo.
[Paradigma]: Declarativo.

Contrato por tipo (lo envía NestJS Practice):
- multiple_choice / fill_blank: answer[i] = respuesta del hueco i · accepted[i] = variantes aceptadas del hueco i
- match_pairs: answer[i] = derecha elegida para la izquierda i · accepted[i] = derechas válidas de la izquierda i
- drag_order: answer = fichas en el orden del estudiante · accepted = órdenes completos aceptados
- mark_errors: prompt = texto · answer = índices de palabra marcados · accepted[0] = índices con error · corrections = índice → corrección
- open_answer: answer[0] = texto libre · accepted[0] = respuestas modelo
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ItemType = Literal["multiple_choice", "fill_blank", "match_pairs", "drag_order", "mark_errors", "open_answer"]
Skill = Literal["structure", "grammar", "vocabulary"]  # Habilidad que evalúa el ítem (RF-112)


class EvaluateRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    item_type: ItemType
    skill: Skill = "grammar"
    language: Literal["en", "fr", "de", "es", "pt", "zh", "ru"] = "en"
    prompt: str = Field(default="", max_length=2000)
    answer: list[str] = Field(..., max_length=60)
    accepted: list[list[str]] = Field(..., min_length=1, max_length=60)
    corrections: dict[str, str] = Field(default_factory=dict)  # mark_errors: "3" → "went"
    explanation: str = Field(default="", max_length=600)  # Explicación del docente (prevalece sobre la del LLM)
    tip: str = Field(default="", max_length=400)
