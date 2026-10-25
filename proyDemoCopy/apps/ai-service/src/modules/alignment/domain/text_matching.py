"""Coincidencia aproximada entre las palabras transcritas y el texto de cada línea (Sprint 9.4, RF-119/RF-124).

[Patrón]: Funciones puras de dominio (sin I/O ni modelo).
[Principio]: SRP + determinístico — el mismo audio transcrito da siempre los mismos tiempos.
[Paradigma]: Funcional.
[Técnica]: `difflib.SequenceMatcher` (stdlib) alinea la secuencia de palabras del texto con la de faster-whisper;
cada palabra que coincide hereda su marca de tiempo y cada línea toma el inicio de su primera y el fin de su última palabra.
"""

from dataclasses import dataclass
from difflib import SequenceMatcher

from src.modules.speech.domain.interfaces.speech_to_text import WordStamp
from src.shared.domain.text_norm import words


@dataclass(frozen=True)
class LineTiming:
    index: int
    start: float | None  # None = ninguna palabra de la línea se reconoció en el audio
    end: float | None
    confidence: float  # Proporción de palabras de la línea encontradas en el audio (0–1)


def align(lines: list[str], stamps: tuple[WordStamp, ...]) -> list[LineTiming]:
    """Inicio y fin de cada línea a partir de las marcas por palabra. [Paradigma]: función pura."""
    # [Aplanado]: (línea, palabra normalizada) en orden de lectura → una sola secuencia comparable con la del audio
    text = [(i, w) for i, line in enumerate(lines) for w in words(line)]
    heard = [words(s.word)[0] if words(s.word) else "" for s in stamps]
    matcher = SequenceMatcher(a=[w for _, w in text], b=heard, autojunk=False)  # `autojunk=False`: no descarta palabras repetidas del estribillo
    hits: dict[int, list[WordStamp]] = {}
    for block in matcher.get_matching_blocks():  # Bloques de palabras idénticas y contiguas en ambas secuencias
        for k in range(block.size):
            hits.setdefault(text[block.a + k][0], []).append(stamps[block.b + k])
    out: list[LineTiming] = []
    for i, line in enumerate(lines):
        found, total = hits.get(i, []), len(words(line)) or 1
        out.append(
            LineTiming(
                index=i,
                start=found[0].start if found else None,
                end=found[-1].end if found else None,
                confidence=round(len(found) / total, 2),
            )
        )
    return _fill_gaps(out)


def _fill_gaps(timings: list[LineTiming]) -> list[LineTiming]:
    """Línea sin coincidencias → hueco entre la anterior y la siguiente (confianza 0: el editor la marca para revisar)."""
    out = list(timings)
    for k, t in enumerate(out):
        if t.start is not None:
            continue
        prev_end = next((x.end for x in reversed(out[:k]) if x.end is not None), None)
        next_start = next((x.start for x in out[k + 1 :] if x.start is not None), None)
        if prev_end is not None and next_start is not None and next_start > prev_end:
            out[k] = LineTiming(index=t.index, start=prev_end, end=next_start, confidence=0.0)
    return out
