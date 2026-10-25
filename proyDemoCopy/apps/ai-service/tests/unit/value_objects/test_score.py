"""Tests del Value Object Score."""
import pytest

from src.modules.grading.domain.value_objects.score import Score
from src.shared.exceptions.custom_errors import ValidationDomainError


class TestScoreValido:
    """Construccion valida dentro de [0, 1]."""

    @pytest.mark.parametrize("value", [0.0, 0.5, 1.0, 0.999])
    def test_acepta_valores_en_rango(self, value: float) -> None:
        score = Score(value)
        assert score.value == value

    def test_es_inmutable(self) -> None:
        score = Score(0.5)
        # [Frozen dataclass]: no permite reasignar
        with pytest.raises(Exception):
            score.value = 0.7  # type: ignore[misc]

    def test_igualdad_por_valor(self) -> None:
        assert Score(0.3) == Score(0.3)
        assert Score(0.3) != Score(0.4)

    def test_factory_perfect(self) -> None:
        assert Score.perfect() == Score(1.0)

    def test_factory_zero(self) -> None:
        assert Score.zero() == Score(0.0)


class TestScoreInvalido:
    """Fuera de rango lanza ValidationDomainError."""

    @pytest.mark.parametrize("value", [-0.01, 1.01, -1.0, 2.0, 100.0])
    def test_rechaza_fuera_de_rango(self, value: float) -> None:
        with pytest.raises(ValidationDomainError):
            Score(value)

    def test_mensaje_incluye_descripcion(self) -> None:
        with pytest.raises(ValidationDomainError, match="Score out of range"):
            Score(5.0)
