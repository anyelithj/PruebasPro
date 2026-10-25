"""Métricas de fluidez a partir de las marcas de tiempo por palabra (RF-102, RF-105).

[Patrón]: Domain Service sin estado.
[Principio]: SRP + determinístico (sin IA) → mismo audio, mismas métricas.
[Paradigma]: Funcional (función pura, sin E/S).
[Por qué]: el juego no premia solo la respuesta correcta: mide tiempo hasta responder, continuidad, palabras y vocabulario reutilizado.
"""

import re
from dataclasses import dataclass
from typing import Iterable, Protocol


class Stamp(Protocol):  # Cualquier objeto con word/start/end (WordStamp del dominio o el DTO del cliente)
    word: str
    start: float
    end: float


@dataclass(frozen=True)
class FluencyMetrics:
    time_to_respond_s: float  # Desde que terminó el estímulo hasta la primera palabra
    speaking_time_s: float  # Primera palabra → última palabra
    pauses: int  # Silencios ≥ umbral entre palabras
    longest_run_s: float  # Racha más larga hablando sin pausa
    words_produced: int
    words_per_minute: float
    reused_vocabulary: tuple[str, ...]  # Palabras objetivo que el usuario dijo
    reuse_ratio: float  # reused / objetivo (0 si no hay lista objetivo)


_WORD = re.compile(r"[\w'’-]+", re.UNICODE)


def _norm(word: str) -> str:
    match = _WORD.search(word.lower())
    return match.group(0) if match else ""


def compute_fluency(
    words: Iterable[Stamp], *, prompt_end_s: float = 0.0, pause_threshold_s: float = 0.6, target_vocabulary: Iterable[str] = ()
) -> FluencyMetrics:
    ws = sorted((w for w in words if _norm(w.word)), key=lambda w: w.start)
    targets = {t for t in (_norm(v) for v in target_vocabulary) if t}
    if not ws:
        return FluencyMetrics(0.0, 0.0, 0, 0.0, 0, 0.0, (), 0.0)

    gaps = [b.start - a.end for a, b in zip(ws, ws[1:])]  # `zip(ws, ws[1:])`: pares consecutivos
    pauses = sum(1 for g in gaps if g >= pause_threshold_s)
    longest, run_start = 0.0, ws[0].start
    for prev, gap, cur in zip(ws, gaps, ws[1:]):
        if gap >= pause_threshold_s:  # La racha se corta en cada pausa
            longest = max(longest, prev.end - run_start)
            run_start = cur.start
    longest = max(longest, ws[-1].end - run_start)

    speaking = max(ws[-1].end - ws[0].start, 0.01)  # Evita dividir entre 0 con una sola palabra instantánea
    said = {_norm(w.word) for w in ws}
    reused = tuple(sorted(targets & said))
    return FluencyMetrics(
        time_to_respond_s=round(max(ws[0].start - prompt_end_s, 0.0), 2),
        speaking_time_s=round(speaking, 2),
        pauses=pauses,
        longest_run_s=round(longest, 2),
        words_produced=len(ws),
        words_per_minute=round(len(ws) / speaking * 60, 1),
        reused_vocabulary=reused,
        reuse_ratio=round(len(reused) / len(targets), 2) if targets else 0.0,
    )
