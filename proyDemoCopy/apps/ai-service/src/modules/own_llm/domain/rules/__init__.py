"""Reglas deterministas del corrector para los 7 idiomas (deterministic-first, Anexo A).

Orden de prioridad (si dos hallazgos se solapan gana el primero): reglas propias del idioma → países y gentilicios → mayúscula inicial.
El signo final se añade al final con `finalize` (se suma al hallazgo de la última palabra si existe).
El LLM solo cubre lo que estas reglas no resuelven; con Ollama caído, el corrector devuelve al menos esto.
[Patrón]: Registry (idioma → reglas) + Chain of Responsibility por prioridad | [Principio]: OCP (un idioma nuevo = una entrada) + DRY
[Paradigma]: Funcional (todas las reglas son funciones puras `(texto, contexto) -> hallazgos`).
"""

from collections.abc import Callable, Mapping, Sequence
from types import MappingProxyType

from src.modules.own_llm.domain.rules.common import apply_findings, capital_start, final_mark, without_overlaps
from src.modules.own_llm.domain.rules.context import RuleContext
from src.modules.own_llm.domain.rules.english import english_findings, plausible
from src.modules.own_llm.domain.rules.places import place_findings
from src.modules.own_llm.domain.rules.spanish import spanish_findings
from src.shared.domain.error_finding import ErrorFinding

Rule = Callable[[str, RuleContext], Sequence[ErrorFinding]]  # Alias de tipo: firma común de toda regla (`Sequence` es covariante → admite list[WritingFinding])

# [Registro]: reglas PROPIAS de cada idioma (las comunes se aplican a todos) | francés, alemán, portugués, ruso y chino → solo comunes + países
LANGUAGE_RULES: Mapping[str, tuple[Rule, ...]] = MappingProxyType({
    "en": (english_findings,),
    "es": (spanish_findings,),
})  # fmt: skip
COMMON_RULES: tuple[Rule, ...] = (place_findings, capital_start)


def rule_findings(text: str, ctx: RuleContext) -> list[ErrorFinding]:
    """Hallazgos deterministas de `text` sin solapes, por prioridad. Función pura."""
    rules = (*LANGUAGE_RULES.get(ctx.language, ()), *COMMON_RULES)  # `*` (PEP 448): concatena tuplas
    return without_overlaps([rule(text, ctx) for rule in rules])


def finalize(text: str, findings: Sequence[ErrorFinding], ctx: RuleContext) -> list[ErrorFinding]:
    """Añade el signo final que falte (punto, «?» o 。/？ en chino). Función pura."""
    return final_mark(text, findings, ctx)


def polish(text: str, language: str) -> str:
    """Texto ya corregido por las reglas del idioma (mayúscula, signo final, ¿¡, países…) — lo usan las traducciones al español. Función pura."""
    if not text.strip():
        return text
    ctx = RuleContext(language)
    return apply_findings(text, finalize(text, rule_findings(text, ctx), ctx))


def opening_marks(text: str) -> str:
    """Solo los signos de apertura del español (¿ ¡) que falten → no toca mayúsculas ni el punto de respuestas cortas («sí»). Función pura."""
    return apply_findings(text, spanish_findings(text, RuleContext("es"))) if text.strip() else text


__all__ = ["RuleContext", "apply_findings", "finalize", "opening_marks", "plausible", "polish", "rule_findings", "without_overlaps"]
