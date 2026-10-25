"""Indicadores medibles de dificultad de un texto (Sprint 9.5, RF-126).

[Patrón]: Strategy (medidor por sistema de escritura: palabras separadas por espacios ↔ caracteres chinos).
[Principio]: determinístico primero — estos números se calculan sin LLM y siempre dan el mismo resultado; OCP (idioma nuevo = otra estrategia).
[Paradigma]: Funcional (funciones puras) + POO estructural (`Protocol`).

Indicadores: longitud media de oración (palabras), longitud media de palabra (letras), riqueza léxica
(tipos/ocurrencias sobre ventanas de 50 palabras: no penaliza los textos largos) y proporción de palabras poco frecuentes.
"""

import re
from dataclasses import dataclass
from typing import Protocol

from src.shared.domain.text_norm import words

# ponytail: «frecuentes» = ~60 palabras funcionales por idioma (artículos, pronombres, verbos auxiliares). Es un indicador grueso;
# cambiarlo por una lista de frecuencias real (p. ej. SUBTLEX o wordfreq) cuando el acuerdo con los docentes lo pida.
COMMON = {
    "en": "the a an and or but to of in on at for with from by is are was were be been am i you he she it we they me him her us them my your his its our their this that these those what who where when how do does did have has had not no yes can will would there here very so if all some more good like go get make know think see come want".split(),
    "es": "el la los las un una y o pero de del a al en con por para es son era fue ser estar está están soy yo tú él ella nosotros ellos me te se le lo mi tu su que qué quién dónde cuándo cómo no sí muy hay este esta eso como más todo bien tener tiene ir hacer ver querer".split(),
    "fr": "le la les un une des et ou mais de du à au en dans avec pour par est sont était être avoir a ai je tu il elle nous vous ils me te se lui mon ton son ma ta sa que qui où quand comment ne pas oui non très il y ce cette ça comme plus tout bien faire aller voir vouloir".split(),
    "de": "der die das ein eine und oder aber zu von in im an auf mit für bei ist sind war waren sein haben hat habe ich du er sie es wir ihr mich mir dich dir sich mein dein sein was wer wo wann wie nicht ja nein sehr gibt dies diese so als mehr alle gut machen gehen sehen wollen".split(),
    "pt": "o a os as um uma e ou mas de do da em no na com por para é são era foi ser estar está eu tu ele ela nós eles me te se lhe meu teu seu minha que quem onde quando como não sim muito há este esta isso mais tudo bem ter tem ir fazer ver querer".split(),
    "ru": "и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам".split(),
}
_SENTENCE = re.compile(r"[.!?…。！？]+")  # Fin de oración en alfabetos latinos, cirílico y chino


@dataclass(frozen=True)
class Measures:
    words: int
    avg_sentence_len: float
    avg_word_len: float
    lexical_richness: float  # 0–1
    rare_ratio: float  # 0–1
    segmented: bool  # False = chino sin segmentador: las «palabras» son caracteres y el indicador es menos fiable


class TextMeasurer(Protocol):
    def measure(self, text: str, language: str) -> Measures: ...


def _sentences(text: str) -> list[str]:
    return [s for s in (p.strip() for p in _SENTENCE.split(text)) if s]


def _richness(tokens: list[str], window: int = 50) -> float:
    """Media de tipos/ocurrencias en ventanas fijas (Mean Segmental TTR). [Paradigma]: función pura."""
    if not tokens:
        return 0.0
    chunks = [tokens[i : i + window] for i in range(0, len(tokens), window)]
    chunks = [c for c in chunks if len(c) == window] or chunks  # Ventana incompleta solo si el texto es corto
    return round(sum(len(set(c)) / len(c) for c in chunks) / len(chunks), 3)


class SpacedMeasurer:
    """Idiomas con palabras separadas por espacios (en, es, fr, de, pt, ru)."""

    def measure(self, text: str, language: str) -> Measures:
        sents = _sentences(text) or [text]
        tokens = words(text)
        common = set(COMMON.get(language, []))
        n = len(tokens) or 1
        return Measures(
            words=len(tokens),
            avg_sentence_len=round(len(tokens) / len(sents), 2),
            avg_word_len=round(sum(len(t) for t in tokens) / n, 2),
            lexical_richness=_richness(tokens),
            rare_ratio=round(sum(t not in common for t in tokens) / n, 3),
            segmented=True,
        )


class HanziMeasurer:
    """Chino mandarín: sin espacios entre palabras. ponytail: cuenta caracteres; un segmentador (p. ej. jieba) daría palabras reales."""

    def measure(self, text: str, language: str) -> Measures:
        chars = re.findall(r"[一-鿿]", text)
        sents = _sentences(text) or [text]
        return Measures(
            words=len(chars),
            avg_sentence_len=round(len(chars) / len(sents) / 1.6, 2),  # ≈ 1,6 caracteres por palabra en mandarín moderno
            avg_word_len=1.6,
            lexical_richness=_richness(chars),
            rare_ratio=0.0,
            segmented=False,
        )


def measurer_for(language: str) -> TextMeasurer:
    return HanziMeasurer() if language == "zh" else SpacedMeasurer()
