"""Caso de uso: estimar el nivel CEFR de un texto o un diálogo (Sprint 9.5, RF-126).

[Patrón]: Use Case (Command) + Chain of Responsibility (indicadores → rúbrica del LLM solo si hay duda) + Strategy (medidor por idioma).
[Principio]: determinístico primero + verificación humana (la respuesta siempre es «estimada») + DIP (juez inyectado).
[Paradigma]: Funcional (bandas y puntuación puras) + asíncrono.
"""

from bisect import bisect_right
from statistics import mean

from src.modules.level_classifier.application.schemas.classify_request import ClassifyRequest
from src.modules.level_classifier.application.schemas.classify_response import ClassifyResponse
from src.modules.level_classifier.domain.value_objects.estimated_level import LEVELS, EstimatedLevel
from src.modules.level_classifier.infrastructure.clients.cefr_rubric_judge import CefrRubricJudge
from src.modules.level_classifier.infrastructure.measures.text_measures import Measures, measurer_for

# [Bandas]: límite superior de A1, A2, B1, B2 y C1 para cada indicador (por encima del último → C2)
# ponytail: bandas calibradas a ojo con textos de ejemplo; recalibrar con la muestra etiquetada por docentes (tests/evaluation).
BANDS: dict[str, tuple[float, ...]] = {
    "avg_sentence_len": (7, 10, 14, 18, 23),
    "avg_word_len": (3.9, 4.3, 4.7, 5.1, 5.5),
    "lexical_richness": (0.55, 0.62, 0.68, 0.74, 0.80),
    "rare_ratio": (0.35, 0.45, 0.55, 0.62, 0.70),
}
_MIN_WORDS = 60  # Con menos palabras los indicadores oscilan mucho → la confianza baja en proporción


def estimate(m: Measures) -> EstimatedLevel:
    """Nivel por indicadores: media de la banda de cada uno; la confianza baja si discrepan o si el texto es corto."""
    used = BANDS if m.segmented else {k: BANDS[k] for k in ("avg_sentence_len", "lexical_richness")}
    if m.words < 50:  # La riqueza léxica de un texto corto siempre es ≈ 1 (todas las palabras distintas) → no informa
        used = {k: v for k, v in used.items() if k != "lexical_richness"}
    values = {k: getattr(m, k) for k in used}
    idx = {k: bisect_right(used[k], v) for k, v in values.items()}  # `bisect_right` (stdlib): banda 0–5 del valor
    score = mean(idx.values())
    spread = max(idx.values()) - min(idx.values())
    confidence = max(0.0, 1 - spread / 5) * min(1.0, m.words / _MIN_WORDS) * (1.0 if m.segmented else 0.5)
    return EstimatedLevel(
        level=LEVELS[round(score)],
        confidence=round(confidence, 2),
        method="measures",
        indicators={**values, "words": float(m.words)},
        explanation=f"Oraciones de {m.avg_sentence_len:g} palabras de media y riqueza léxica {m.lexical_richness:g}.",
    )


class ClassifyTextUseCase:
    def __init__(self, judge: CefrRubricJudge, min_confidence: float) -> None:
        self._judge = judge
        self._min = min_confidence

    async def execute(self, req: ClassifyRequest) -> ClassifyResponse:
        text = req.content
        est = estimate(measurer_for(req.language).measure(text, req.language))
        if est.confidence < self._min:  # [Caso dudoso]: la rúbrica del LLM decide; si no responde, quedan los indicadores
            judged = await self._judge.judge(text, req.language, est.level)
            if judged:
                level, reason = judged
                near = abs(LEVELS.index(level) - LEVELS.index(est.level)) <= 1  # LLM e indicadores coinciden ± 1 nivel
                est = EstimatedLevel(
                    level=level,
                    confidence=round(max(est.confidence, 0.6 if near else 0.4), 2),
                    method="rubric",
                    indicators=est.indicators,
                    explanation=reason or est.explanation,
                    model=self._judge.model,
                )
        return ClassifyResponse(**est.__dict__)
