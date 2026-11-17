"""Países y gentilicios en los 7 idiomas: «Columbia» → «Colombia», mayúsculas y tildes del país, y mayúscula del gentilicio según el idioma.

[2026-11-13 · Caso A]: «I'm from Columbia» → «Colombia» (Columbia es otro lugar: Columbia Británica, el distrito de Columbia o una universidad).
Regla de mayúsculas del gentilicio (verificada por idioma): inglés SIEMPRE con mayúscula (Colombian, Spanish) · español y portugués SIEMPRE en
minúscula (colombiano, brasileiro) · francés: el adjetivo en minúscula («je suis colombien»), el sustantivo con mayúscula («un Colombien») →
solo se marca tras el verbo «être» · alemán y ruso: el gentilicio cambia de forma por caso/género → no se tocan (las reglas no adivinan).
[Patrón]: Lookup Table por idioma + reglas puras | [Principio]: datos curados (no inventados) + OCP | [Paradigma]: Funcional.
"""

import unicodedata  # stdlib: quitar tildes para comparar «Mexico» con «México»
from collections.abc import Mapping
from types import MappingProxyType

from src.modules.own_llm.domain.rules.common import WORD
from src.modules.own_llm.domain.rules.context import RuleContext
from src.modules.own_llm.domain.writing_finding import WritingErrorType as T
from src.modules.own_llm.domain.writing_finding import WritingFinding as F

# [COUNTRIES]: forma correcta del país en cada idioma (países frecuentes en la plataforma) | ponytail: lista corta A1–B1; ampliar con los docentes
COUNTRIES: Mapping[str, tuple[str, ...]] = MappingProxyType({
    "en": ("Colombia", "Mexico", "Spain", "Peru", "Argentina", "Chile", "Venezuela", "Ecuador", "Brazil", "France", "Germany", "Italy", "Portugal", "Russia", "China", "England", "Canada", "Japan"),
    "es": ("Colombia", "México", "España", "Perú", "Argentina", "Chile", "Venezuela", "Ecuador", "Brasil", "Francia", "Alemania", "Italia", "Portugal", "Rusia", "China", "Inglaterra", "Canadá", "Japón"),
    "fr": ("Colombie", "Mexique", "Espagne", "Pérou", "Argentine", "Chili", "Venezuela", "Équateur", "Brésil", "France", "Allemagne", "Italie", "Portugal", "Russie", "Chine", "Angleterre", "Canada", "Japon"),
    "de": ("Kolumbien", "Mexiko", "Spanien", "Peru", "Argentinien", "Chile", "Venezuela", "Ecuador", "Brasilien", "Frankreich", "Deutschland", "Italien", "Portugal", "Russland", "China", "England", "Kanada", "Japan"),
    "pt": ("Colômbia", "México", "Espanha", "Peru", "Argentina", "Chile", "Venezuela", "Equador", "Brasil", "França", "Alemanha", "Itália", "Portugal", "Rússia", "China", "Inglaterra", "Canadá", "Japão"),
    "ru": ("Колумбия", "Мексика", "Испания", "Перу", "Аргентина", "Чили", "Венесуэла", "Эквадор", "Бразилия", "Франция", "Германия", "Италия", "Португалия", "Россия", "Китай", "Англия", "Канада", "Япония"),
})  # fmt: skip
COLOMBIA = MappingProxyType({lang: names[0] for lang, names in COUNTRIES.items()})  # Primer país de cada tupla = Colombia

# [Gentilicios e idiomas]: forma base en minúscula → regla de mayúscula de su idioma
_EN_DEMONYMS = frozenset(
    "colombian spanish english french german italian portuguese russian chinese mexican american brazilian peruvian "
    "argentinian argentine chilean venezuelan ecuadorian canadian japanese british".split()
)
# `{f"{s}{e}" for …}` (comprensión de conjunto): raíz × terminación de género y número
_ES_DEMONYMS = frozenset({f"{s}{e}" for s in "colombian mexican italian peruan argentin chilen venezolan ecuatorian brasileñ chin rus american".split() for e in ("o", "a", "os", "as")}
                         | {"español", "española", "españoles", "españolas", "inglés", "inglesa", "ingleses", "inglesas", "francés", "francesa", "franceses", "francesas",
                            "alemán", "alemana", "alemanes", "alemanas", "portugués", "portuguesa", "portugueses", "portuguesas", "estadounidense", "estadounidenses"})  # fmt: skip
_PT_DEMONYMS = frozenset({f"{s}{e}" for s in "colombian mexican italian peruan argentin chilen venezuelan equatorian brasileir russ american".split() for e in ("o", "a", "os", "as")}
                         | {"espanhol", "espanhola", "inglês", "inglesa", "francês", "francesa", "alemão", "alemã", "português", "portuguesa", "chinês", "chinesa"})  # fmt: skip
_FR_DEMONYMS = frozenset({f"{s}{e}" for s in ("colombien", "italien", "péruvien", "chilien", "brésilien", "vénézuélien", "équatorien", "canadien") for e in ("", "ne", "s", "nes")}
                         | {f"{s}{e}" for s in ("espagnol", "allemand", "mexicain", "argentin", "américain") for e in ("", "e", "s", "es")}
                         | {"anglais", "anglaise", "anglaises", "français", "française", "françaises", "portugais", "portugaise", "portugaises", "chinois", "chinoise", "chinoises", "russe", "russes"})  # fmt: skip
_FR_ETRE = frozenset("suis es est sommes êtes sont".split())  # Tras «être» el gentilicio es adjetivo → minúscula

_DEMONYMS = MappingProxyType({"en": _EN_DEMONYMS, "es": _ES_DEMONYMS, "pt": _PT_DEMONYMS, "fr": _FR_DEMONYMS})


def _plain(s: str) -> str:
    """Sin tildes y en minúscula («México» → «mexico») | `unicodedata.normalize("NFD")` separa letra y tilde. Función pura."""
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def _sentence_start(text: str, start: int) -> bool:
    before = text[:start].rstrip(" ¿¡\"'«(")
    return not before or before[-1] in ".!?…"


def place_findings(text: str, ctx: RuleContext) -> list[F]:
    """Hallazgos de países y gentilicios del idioma `ctx.language` (el chino no tiene mayúsculas). Función pura."""
    names = COUNTRIES.get(ctx.language)
    if not names:
        return []
    by_plain = {_plain(n): n for n in names}  # «mexico» → «México» (es) / «Mexico» (en)
    demonyms = _DEMONYMS.get(ctx.language, frozenset())
    words = list(WORD.finditer(text))
    out: list[F] = []
    for k, m in enumerate(words):
        w, start, end = m.group(), m.start(), m.end()
        nxt = words[k + 1].group() if k + 1 < len(words) else ""
        prev = words[k - 1].group().lower() if k else ""
        if _plain(w) == "columbia" and ctx.language in COLOMBIA and ctx.language != "ru":
            # «Columbia University», «British Columbia», «District of Columbia», «Columbia Británica» son lugares reales → no se tocan
            if nxt[:1].isupper() or prev in ("british", "of") or nxt.lower() in ("británica", "britannique", "britânica"):
                continue
            right = COLOMBIA[ctx.language]
            out.append(F(type=T.SPELLING, original=w, correction=right, start=start, end=end, explanation_es=(
                f"El país se escribe «{right}»; «Columbia» es otro lugar (una región de Canadá, un distrito de EE. UU. o una universidad)."
            )))  # fmt: skip
        elif (canon := by_plain.get(_plain(w))) and w != canon:  # `:=` (PEP 572): asigna dentro de la condición
            caps = w.lower() == canon.lower()  # Solo cambia la mayúscula; si no, faltaba una tilde
            out.append(F(type=T.CAPITALIZATION if caps else T.SPELLING, original=w, correction=canon, start=start, end=end, explanation_es=(
                "Los nombres de países se escriben con mayúscula inicial." if caps else f"El país se escribe «{canon}», con tilde."
            )))  # fmt: skip
        elif w.lower() in demonyms and _plain(w) not in by_plain and not _sentence_start(text, start):  # «China» (país) ≠ «china» (gentilicio)
            if ctx.language == "en" and w[0].islower():
                out.append(F(type=T.CAPITALIZATION, original=w, correction=w[0].upper() + w[1:], start=start, end=end,
                             explanation_es="En inglés las nacionalidades y los idiomas se escriben con mayúscula (Colombian, Spanish)."))  # fmt: skip
            elif ctx.language in ("es", "pt") and w[0].isupper():
                out.append(F(type=T.CAPITALIZATION, original=w, correction=w.lower(), start=start, end=end,
                             explanation_es="En este idioma las nacionalidades y los idiomas se escriben con minúscula (colombiano, español)."))  # fmt: skip
            elif ctx.language == "fr" and w[0].isupper() and prev in _FR_ETRE:
                out.append(F(type=T.CAPITALIZATION, original=w, correction=w.lower(), start=start, end=end,
                             explanation_es="En francés la nacionalidad como adjetivo («je suis colombien») va en minúscula; solo el sustantivo («un Colombien») lleva mayúscula."))  # fmt: skip
    return out

