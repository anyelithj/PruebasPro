"""Reglas puras del RAG del temario (Tarea 9 · RF-57): tema de cada recurso, fragmentación por concepto y coincidencia de palabras clave.

[Patrón]: Domain Service sin estado + Table-Driven (tipo de recurso → tema) | [Principio]: SRP + Deterministic-first (sin modelo)
[Paradigma]: Funcional — todas son funciones puras (misma entrada → misma salida), fáciles de probar.
"""

import re  # stdlib: expresiones regulares (tokens y oraciones)
import unicodedata  # stdlib: quitar tildes para comparar «gramática» con «gramatica»
from typing import Literal

Theme = Literal["gramatica", "vocabulario", "frases", "pronunciacion"]  # `Literal` (typing): los 4 temas del RAG

# [Tabla tipo de recurso → tema]: `dict` inmutable por convención (constante de módulo) | [Principio]: OCP (nuevo tipo = nueva entrada)
_THEME_BY_KIND: dict[str, Theme] = {
    "grammar_rule": "gramatica",
    "common_error": "gramatica",
    "vocabulary": "vocabulario",
    "example": "frases",
    "translation": "frases",
    "pronunciation": "pronunciacion",
}

MAX_WORDS = 500  # Tope del fragmento: cabe en el contexto del modelo pequeño junto a otros 4
_SENTENCE = re.compile(r"(?<=[.!?…])\s+|\n+")  # Corte entre oraciones o líneas (el `(?<=…)` conserva el signo)
_TOKEN = re.compile(r"[^\W\d_]{2,}")  # Palabras de 2+ letras en cualquier alfabeto (`\w` sin dígitos ni «_»)
# [Palabras vacías]: no cuentan como coincidencia (si no, «the» o «de» acercarían cualquier fragmento) | `frozenset`: búsqueda O(1)
_STOP = frozenset(
    "de la el los las un una y o en que se es por para con del al lo como mas pero sus le ya the an and or of to in is are for on with "
    "it this that be as at by from me mi tu te no si".split()
)


def theme_of(kind: str) -> Theme | None:
    """Tema del RAG para un tipo de recurso (None = no es material explicativo, p. ej. ejercicios)."""
    return _THEME_BY_KIND.get(kind)


def chunk_words(header: str, body: str, max_words: int = MAX_WORDS) -> list[str]:
    """Parte `body` en fragmentos de ≤ `max_words` palabras SIN cortar oraciones; cada uno lleva `header` (concepto + idioma + nivel).

    Un recurso del temario ya es UN concepto (regla + ejemplos): casi siempre cabe en un fragmento. Solo los textos largos
    importados (PDF, página web) se parten; el encabezado repetido mantiene el concepto identificable en cada parte.
    [ponytail]: un recurso corto (< 200 palabras) NO se fusiona con otro → «un concepto por fragmento» manda sobre el mínimo de 200.
    """
    sentences = [s.strip() for s in _SENTENCE.split(body) if s.strip()]
    chunks: list[list[str]] = [[]]
    for sentence in sentences:
        size = sum(len(s.split()) for s in chunks[-1])
        if chunks[-1] and size + len(sentence.split()) > max_words:
            chunks.append([])  # La oración no cabe → abre otro fragmento
        chunks[-1].append(sentence)
    return [f"{header} {' '.join(c)}".strip() for c in chunks if c]


def _plain(text: str) -> str:
    """Minúsculas sin tildes («Gramática» → «gramatica»). `NFKD` separa la letra de su tilde y `combining` la descarta."""
    return "".join(ch for ch in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(ch))


def keywords(text: str) -> frozenset[str]:
    """Palabras con contenido de un texto (sin tildes ni palabras vacías)."""
    return frozenset(w for w in _TOKEN.findall(_plain(text)) if w not in _STOP)


def keyword_score(query: str, text: str) -> float:
    """Parte de las palabras de la consulta que aparecen en el texto (0..1) → la mitad «palabras clave» de la búsqueda híbrida."""
    wanted = keywords(query)
    return len(wanted & keywords(text)) / len(wanted) if wanted else 0.0  # `&` (set): intersección
