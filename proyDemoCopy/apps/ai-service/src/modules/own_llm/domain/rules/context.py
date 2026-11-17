"""Contexto de las reglas deterministas: idioma, pregunta previa y origen (voz o escrito).

[2026-11-13 · Anexo A]: el corrector usa «pregunta_previa» para entender qué quiso decir el estudiante y «origen» para distinguir
un error de transcripción del dictado de voz de una falta real del estudiante.
[Patrón]: Value Object inmutable (`@dataclass(frozen=True)`) | [Principio]: SRP (solo datos) | [Paradigma]: Declarativo.
"""

from dataclasses import dataclass  # stdlib: clase de datos con __init__/__eq__ generados


@dataclass(frozen=True, slots=True)  # `frozen` = inmutable (hashable) · `slots` = sin __dict__ (menos memoria)
class RuleContext:
    language: str  # ISO 639-1 de los 7 idiomas de la plataforma: en, es, fr, de, pt, zh, ru
    question: str = ""  # Pregunta previa del avatar o del ejercicio («What's your name?») · vacía si no hay
    spoken: bool = False  # True = el texto viene del reconocimiento de voz (origen «voz»)
