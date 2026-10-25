"""Normalización de texto para comparar respuestas (Sprint 8.7 / 8.13).

[Patrón]: Funciones puras de dominio compartido (Shared Kernel).
[Principio]: DRY — la usan los motores de juego (Assistant) y los evaluadores de práctica (Grading).
[Paradigma]: Funcional.
"""

import re
import unicodedata


def norm(text: str) -> str:
    """minúsculas + sin tildes + espacios simples: «  Café » == «cafe». `NFD` separa la tilde de la letra (categoría Mn)."""
    plain = "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")
    return " ".join(plain.split())


def words(text: str) -> list[str]:
    """Palabras normalizadas (conserva apóstrofos y guiones: «don't», «well-known»)."""
    return re.findall(r"[\w'’-]+", norm(text))


def says(text: str, term: str) -> bool:
    """¿El texto contiene el término (palabra o expresión completa)? Evita falsos positivos («cat» en «category»)."""
    t, w = words(term), words(text)
    return bool(t) and any(w[i : i + len(t)] == t for i in range(len(w) - len(t) + 1))


# [Palabras muy frecuentes y casi exclusivas del español]: si dominan una respuesta que debía ir en otro idioma, el modelo «se pasó» al español
_SPANISH_MARKERS = frozenset(
    "que por qué porque el la los las una unos es está estás tiene tienen te gusta comida también muy pero con para como cómo creo sabor y de del".split()
)


def drifted_to_spanish(text: str, language: str) -> bool:
    """¿Respuesta en español cuando el idioma objetivo es otro? Heurística sin dependencias: «¿/¡/ñ» o ≥ 30 % de marcadores españoles.

    [Bug 2026-10-19]: en un diálogo en inglés el avatar contestó «¿Por qué te gusta el sabor de la comida mexicana?…».
    ponytail: heurística por palabras frecuentes; un detector de idioma (fastText lid) si aparecen falsos positivos (p. ej. portugués).
    """
    if language == "es" or not text.strip():
        return False
    if language not in ("pt",) and any(c in text for c in "¿¡ñ"):
        return True
    w = words(text)
    return len(w) >= 3 and sum(x in _SPANISH_MARKERS for x in w) / len(w) >= 0.3
