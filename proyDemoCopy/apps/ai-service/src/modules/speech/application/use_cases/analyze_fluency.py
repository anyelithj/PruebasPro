"""Caso de uso: métricas de fluidez a partir de las marcas de tiempo.

[Patrón]: Use Case (Query) sobre un Domain Service puro.
[Principio]: SRP + determinístico (sin IA).
[Paradigma]: Funcional.
"""

from dataclasses import asdict

from src.modules.speech.application.schemas.fluency_request import FluencyRequest, FluencyResponse
from src.modules.speech.domain.fluency_metrics import compute_fluency


class AnalyzeFluencyUseCase:
    def __init__(self, default_pause_s: float) -> None:
        self._pause = default_pause_s

    def execute(self, req: FluencyRequest) -> FluencyResponse:
        metrics = compute_fluency(
            req.words,
            prompt_end_s=req.prompt_end_s,
            pause_threshold_s=req.pause_threshold_s or self._pause,
            target_vocabulary=req.target_vocabulary,
        )
        data = asdict(metrics)  # `asdict` (dataclasses): dataclass → dict para el DTO
        data["reused_vocabulary"] = list(data["reused_vocabulary"])
        return FluencyResponse(**data)
