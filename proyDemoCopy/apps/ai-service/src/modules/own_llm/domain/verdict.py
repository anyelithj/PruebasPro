"""Veredicto, puntuación y categorías del Anexo A a partir de los hallazgos ubicados (funciones puras).

[2026-11-13 · Caso A]: la UI mostraba «100 % · Tu frase es correcta» sobre una frase con errores porque el porcentaje se calculaba aparte.
Ahora el veredicto y la puntuación salen del MISMO JSON: «correcta» solo sin errores y 100 solo si es «correcta».
Un posible error de dictado no resta puntos (no es falta del estudiante), pero la frase sigue sin ser «correcta».
[Patrón]: Lookup Table + funciones puras | [Principio]: SSOT (una sola regla para feedback, puntuación y avatar) | [Paradigma]: Funcional.
"""

import re  # stdlib: búsqueda de palabras vecinas
from collections.abc import Mapping, Sequence
from types import MappingProxyType

from src.modules.own_llm.domain.writing_finding import WritingErrorType as T
from src.shared.domain.error_finding import ErrorFinding

# [Categoría interna → categoría del Anexo A] | artículo y orden de palabras son gramática; estilo, vocabulario
TO_ANNEX: Mapping[str, str] = MappingProxyType({
    T.SPELLING.value: "ortografia", T.CAPITALIZATION.value: "mayuscula", T.PUNCTUATION.value: "puntuacion",
    T.GRAMMAR.value: "gramatica", T.ARTICLE.value: "gramatica", T.WORD_ORDER.value: "gramatica",
    T.VOCABULARY.value: "vocabulario", T.STYLE.value: "vocabulario", T.TRANSCRIPTION.value: "posible_error_de_transcripcion",
})  # fmt: skip
# [Categoría del Anexo A → interna] (para ubicar los errores que propone el LLM)
FROM_ANNEX: Mapping[str, T] = MappingProxyType({
    "ortografia": T.SPELLING, "mayuscula": T.CAPITALIZATION, "puntuacion": T.PUNCTUATION, "gramatica": T.GRAMMAR,
    "vocabulario": T.VOCABULARY, "posible_error_de_transcripcion": T.TRANSCRIPTION,
})  # fmt: skip

MAX_WITH_ERRORS = 90  # Con cualquier error la puntuación nunca llega a 100 (criterio de aceptación)
PENALTY = 15  # Puntos por cada falta del estudiante
FLOOR = 10  # Responder con errores vale más que no responder (0)
DEFAULT_COMMENT: Mapping[str, str] = MappingProxyType({
    "correcta": "¡Muy bien dicho!",
    "con_errores": "Casi lo tienes; repite la frase corregida en voz alta.",
    "no_responde": "Intenta responder a la pregunta con una frase corta.",
})


def score(verdict: str, categories: Sequence[str]) -> int:
    """0–100 coherente con el veredicto: 100 solo «correcta» · 0 «no_responde» · con errores ≤ 90 (los de dictado no restan). Función pura."""
    if verdict == "correcta":
        return 100
    if verdict == "no_responde":
        return 0
    faults = sum(1 for c in categories if c != "posible_error_de_transcripcion")  # Generador: cuenta solo faltas del estudiante
    return max(FLOOR, MAX_WITH_ERRORS - PENALTY * faults)


def verdict_of(errors: Sequence[str], model_says: str | None) -> str:
    """«correcta» sin errores · «no_responde» solo si el modelo lo dijo y no hay corrección mínima · resto «con_errores». Función pura."""
    if errors:
        return "con_errores"
    return "no_responde" if model_says == "no_responde" else "correcta"


_WORD = re.compile(r"\S+")


def display(text: str, f: ErrorFinding) -> tuple[str, str]:
    """(original, sugerencia) legibles: un hallazgo que solo cambia el espacio entre palabras («Laura I'm» → «Laura. I'm»)
    se muestra con las palabras vecinas. Función pura."""
    if f.original.strip() or f.start is None or f.end is None:
        return f.original, f.correction
    before = [m for m in _WORD.finditer(text) if m.end() <= f.start]
    after = next((m for m in _WORD.finditer(text) if m.start() >= f.end), None)  # `next(gen, None)`: primera palabra siguiente
    a = before[-1].start() if before else f.start
    b = after.end() if after else f.end
    return text[a:b], f"{text[a : f.start]}{f.correction}{text[f.end : b]}"
