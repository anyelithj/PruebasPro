"""Habilidad del ítem → categoría de error (estructura = orden de palabras).

[Patrón]: Lookup Table.
[Principio]: SSOT + DRY (lo usan los cuatro evaluadores).
[Paradigma]: Funcional.
"""

from types import MappingProxyType

from src.shared.domain.error_finding import ErrorType

_BY_SKILL = MappingProxyType({"structure": ErrorType.WORD_ORDER, "grammar": ErrorType.GRAMMAR, "vocabulary": ErrorType.VOCABULARY})


def error_type_for(skill: str) -> ErrorType:
    return _BY_SKILL.get(skill, ErrorType.GRAMMAR)
