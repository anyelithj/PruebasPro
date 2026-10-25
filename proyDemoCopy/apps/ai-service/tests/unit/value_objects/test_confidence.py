"""Tests del Value Object Confidence."""
import pytest

from src.modules.grading.domain.value_objects.confidence import Confidence
from src.shared.exceptions.custom_errors import ValidationDomainError


class TestConfidenceValido:
    """Construccion valida en [0, 1]."""

    @pytest.mark.parametrize("value", [0.0, 0.25, 0.5, 0.75, 1.0])
    def test_acepta_valores_en_rango(self, value: float) -> None:
        assert Confidence(value).value == value

    def test_es_inmutable(self) -> None:
        conf = Confidence(0.5)
        with pytest.raises(Exception):
            conf.value = 0.9  # type: ignore[misc]


class TestConfidenceInvalido:
    @pytest.mark.parametrize("value", [-0.1, 1.1, -5.0, 3.0])
    def test_rechaza_fuera_de_rango(self, value: float) -> None:
        with pytest.raises(ValidationDomainError, match="Confidence out of range"):
            Confidence(value)


class TestConfidencePropiedades:
    """is_high (>= 0.75) e is_low (< 0.5)."""

    @pytest.mark.parametrize(
        "value,expected",
        [(0.75, True), (0.9, True), (1.0, True), (0.74, False), (0.0, False)],
    )
    def test_is_high(self, value: float, expected: bool) -> None:
        assert Confidence(value).is_high is expected

    @pytest.mark.parametrize(
        "value,expected",
        [(0.49, True), (0.0, True), (0.5, False), (0.75, False), (1.0, False)],
    )
    def test_is_low(self, value: float, expected: bool) -> None:
        assert Confidence(value).is_low is expected

    def test_zona_media_ni_alta_ni_baja(self) -> None:
        # [Banda 0.5..0.75): ni high ni low
        conf = Confidence(0.6)
        assert conf.is_high is False
        assert conf.is_low is False
