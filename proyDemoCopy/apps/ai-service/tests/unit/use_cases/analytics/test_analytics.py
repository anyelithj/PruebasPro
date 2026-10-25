"""Tests de analítica (Sprint 5.4): KMeans de dificultad, IsolationForest de anomalías y respaldo determinista."""

from src.modules.analytics.application.use_cases.classify_difficulty import (
    ClassifyDifficultyUseCase,
)
from src.modules.analytics.application.use_cases.detect_anomalies import (
    DetectAnomaliesUseCase,
)
from src.modules.analytics.domain.entities.difficulty_label import QuestionStats
from src.modules.analytics.infrastructure.models.classifier import classify, detect


def _q(
    i: int, original: str, err: float, ms: float, attempts: int = 30
) -> QuestionStats:
    return QuestionStats(
        question_id=f"q{i}",
        original=original,
        attempts=attempts,
        error_rate=err,
        avg_time_ms=ms,
    )  # type: ignore[arg-type]


# [Datos sintéticos]: 3 grupos claros (fácil/medio/difícil) + una pregunta «fácil» que en realidad falla casi todo el mundo
DATA = [
    _q(1, "easy", 0.05, 8000),
    _q(2, "easy", 0.08, 9000),
    _q(3, "easy", 0.10, 8500),
    _q(4, "medium", 0.45, 15000),
    _q(5, "medium", 0.50, 16000),
    _q(6, "medium", 0.48, 15500),
    _q(7, "hard", 0.85, 25000),
    _q(8, "hard", 0.90, 26000),
    _q(9, "easy", 0.88, 24000),  # q9: declarada fácil
]


class FakeRepo:
    def __init__(self, stats: list[QuestionStats]) -> None:
        self.stats = stats

    async def question_stats(self, min_attempts: int) -> list[QuestionStats]:
        return [s for s in self.stats if s.attempts >= min_attempts]


class TestClassifier:
    def test_kmeans_ordena_los_grupos_por_tasa_de_error(self) -> None:
        labels = {lb.question_id: lb for lb in classify(DATA)}
        assert labels["q1"].computed == "easy"
        assert labels["q5"].computed == "medium"
        assert labels["q8"].computed == "hard"
        assert (
            labels["q9"].computed == "hard" and labels["q9"].mismatch
        )  # Declarada fácil, los datos dicen difícil
        assert all(0 <= lb.confidence <= 1 for lb in labels.values())

    def test_con_pocos_datos_usa_umbrales_deterministas(self) -> None:
        labels = classify([_q(1, "hard", 0.1, 5000), _q(2, "easy", 0.7, 5000)])
        assert [lb.computed for lb in labels] == ["easy", "hard"]

    def test_anomalias_marca_la_pregunta_atipica_y_no_inventa_con_pocos_datos(
        self,
    ) -> None:
        outlier = _q(
            99, "medium", 0.98, 900, attempts=200
        )  # Casi todos fallan y responden en menos de 1 s
        found = detect(DATA + [outlier], contamination=0.1)
        assert found and found[0].question_id == "q99"
        assert "falla" in found[0].reason and "rápido" in found[0].reason
        assert detect(DATA[:3]) == []


class TestUseCases:
    async def test_dificultad_resume_metodo_y_discrepancias(self) -> None:
        res = await ClassifyDifficultyUseCase(FakeRepo(DATA)).execute(min_attempts=5)
        assert res.method == "kmeans"
        assert res.mismatches >= 1
        assert {q.question_id for q in res.questions} == {s.question_id for s in DATA}

    async def test_respeta_el_minimo_de_respuestas(self) -> None:
        res = await DetectAnomaliesUseCase(FakeRepo(DATA)).execute(min_attempts=100)
        assert res.analyzed == 0 and res.anomalies == []
