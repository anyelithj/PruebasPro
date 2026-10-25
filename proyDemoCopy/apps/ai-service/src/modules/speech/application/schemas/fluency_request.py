"""Schemas Pydantic v2 — POST /speech/fluency.

[Patrón]: DTO inmutable.
[Principio]: Fail Fast (límites en la frontera) + ISP.
[Paradigma]: Declarativo.
"""

from pydantic import BaseModel, ConfigDict, Field

from src.modules.speech.application.schemas.transcribe_response import WordStampOut


class FluencyRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    words: list[WordStampOut] = Field(..., max_length=2000)  # Las marcas que devolvió /speech/transcribe
    prompt_end_s: float = Field(default=0.0, ge=0)  # Segundo en que terminó el estímulo → tiempo hasta responder
    target_vocabulary: list[str] = Field(default_factory=list, max_length=200)  # Vocabulario de la sesión
    pause_threshold_s: float | None = Field(default=None, gt=0, le=5)  # None → SPEECH_PAUSE_THRESHOLD_S


class FluencyResponse(BaseModel):
    time_to_respond_s: float
    speaking_time_s: float
    pauses: int
    longest_run_s: float
    words_produced: int
    words_per_minute: float
    reused_vocabulary: list[str]
    reuse_ratio: float
