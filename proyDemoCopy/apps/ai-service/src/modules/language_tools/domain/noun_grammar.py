"""Gramática obligatoria de los sustantivos del vocabulario (regla 2026-11-03).

[Regla]: un sustantivo se aprende como unidad gramatical completa, no como palabra traducida:
de/fr/pt/es → artículo definido + género + plural · en → artículo natural (a/an/the o ninguno) + contable/incontable
ru → género + nominativo plural (+ casos) · zh → caracteres + pinyin + clasificador.
[Patrón]: Value Object + Specification (`missing`) | [Principio]: determinístico primero (el LLM propone, el servidor valida y normaliza).
[Paradigma]: Funcional (funciones puras, sin E/S).
"""

from typing import Literal

from pydantic import BaseModel, Field

Gender = Literal["m", "f", "n"]

# Artículos definidos válidos por idioma y género (singular) + el del plural | [Patrón]: Lookup Table
DEFINITE = {
    "de": {"m": "der", "f": "die", "n": "das"},
    "fr": {"m": "le", "f": "la"},
    "pt": {"m": "o", "f": "a"},
    "es": {"m": "el", "f": "la"},
}
PLURAL_ARTICLE = {"de": {"m": "die", "f": "die", "n": "die"}, "fr": {"m": "les", "f": "les"}, "pt": {"m": "os", "f": "as"}, "es": {"m": "los", "f": "las"}}
GENDERS = {"de": ("m", "f", "n"), "fr": ("m", "f"), "pt": ("m", "f"), "es": ("m", "f"), "ru": ("m", "f", "n")}
_FR_VOWEL = "aeiouyhâàéèêëîïôûùœ"
CASES_RU = ("nominativo", "genitivo", "dativo", "acusativo", "instrumental", "preposicional")


class NounGrammar(BaseModel):
    """Datos gramaticales de una entrada. `is_noun=False` → no se exige nada (verbos, adjetivos, frases)."""

    is_noun: bool = False
    article: str | None = None  # der/die/das · le/la/l' · o/a · el/la · a/an/the/"" (en)
    gender: Gender | None = None
    plural: str | None = None  # Forma plural SIN artículo (Tische, livres, книги)
    plural_article: str | None = None  # die · les · os/as · los/las
    countable: bool | None = None  # Solo inglés
    pinyin: str | None = None  # Solo chino
    classifier: str | None = None  # Solo chino: 本, 个, 张…
    measure_example: str | None = None  # Solo chino: 一本书 (yì běn shū)
    cases: dict[str, str] = Field(default_factory=dict)  # Solo ruso (opcional): caso → forma singular


def normalize(language: str, lemma: str, g: NounGrammar) -> NounGrammar:
    """Corrige lo que el LLM suele fallar: artículo coherente con el género, «l'» ante vocal, artículo del plural. Función pura."""
    if not g.is_noun:
        return NounGrammar()
    upd: dict[str, object] = {}
    if language in DEFINITE and g.gender in DEFINITE[language]:
        art = DEFINITE[language][g.gender]
        if language == "fr" and lemma[:1].lower() in _FR_VOWEL:
            art = "l'"  # [Regla fr]: l'école, l'homme
        upd["article"] = art
        upd["plural_article"] = PLURAL_ARTICLE[language][g.gender]
    if language not in GENDERS:
        upd["gender"] = None
    if language == "en" and g.article not in ("a", "an", "the", "", None):
        upd["article"] = None
    if language == "en" and g.countable is False:
        upd["article"] = ""  # [Regla en]: incontable → sin artículo indefinido («water»)
    if language in ("de", "fr", "pt", "es", "ru", "en") and g.plural:
        upd["plural"] = g.plural.split()[-1] if language != "en" else g.plural  # El LLM a veces mete el artículo en el plural («die Tische»)
    return g.model_copy(update=upd)


def missing(language: str, g: NounGrammar) -> list[str]:
    """Campos obligatorios que faltan según el idioma ([] = entrada completa). [Patrón]: Specification."""
    if not g.is_noun:
        return []
    need: tuple[str, ...] = {
        "de": ("article", "gender", "plural"),
        "fr": ("article", "gender", "plural"),
        "pt": ("article", "gender", "plural"),
        "es": ("article", "gender", "plural"),
        "ru": ("gender", "plural"),
        "en": ("countable",),
        "zh": ("pinyin", "classifier"),
    }.get(language, ())
    return [f for f in need if getattr(g, f) in (None, "") and not (f == "plural" and g.countable is False)]


def headword(language: str, lemma: str, g: NounGrammar) -> str:
    """Cómo se muestra en la tarjeta: «der Tisch – die Tische», «l'école – les écoles», «стол (m) – столы», «一本书 (yì běn shū)». Función pura."""
    if not g.is_noun:
        return lemma
    if language in DEFINITE:
        sing = f"{g.article}{lemma}" if g.article == "l'" else f"{g.article} {lemma}"
        return f"{sing} – {g.plural_article} {g.plural}" if g.plural else sing
    if language == "ru":
        return f"{lemma} ({g.gender}) – {g.plural}" if g.plural else f"{lemma} ({g.gender})"
    if language == "zh":
        return f"{g.measure_example or lemma} ({g.pinyin})" if g.pinyin else lemma
    if language == "en":
        return f"{g.article} {lemma}".strip() if g.article else lemma
    return lemma


SYSTEM_PROMPT = (
    "Eres un lexicógrafo. Devuelve SOLO JSON con la gramática del término en su idioma. Si NO es un sustantivo: {\"is_noun\": false}. "
    'Si es sustantivo: {"is_noun": true, "lemma": forma de diccionario en singular, "gender": "m"|"f"|"n"|null, "article": artículo definido singular, '
    '"plural": plural SIN artículo, "countable": true|false (solo inglés), "pinyin": (solo chino), "classifier": clasificador (solo chino), '
    '"measure_example": "一+clasificador+sustantivo" (solo chino), "cases": {caso: forma} (solo ruso, los seis casos en singular)}. '
    "Alemán: der/die/das y plural. Francés: le/la/l' y plural. Portugués: o/a. Español: el/la. Inglés: a/an/the o \"\" si es incontable. "
    "Ruso: sin artículos, género y nominativo plural. Chino: sin artículos; pinyin con tonos y clasificador. "
    'Ejemplos: Idioma: alemán, Término: Tisch → {"is_noun": true, "lemma": "Tisch", "gender": "m", "article": "der", "plural": "Tische"}; '
    'Idioma: chino, Término: 书 → {"is_noun": true, "lemma": "书", "pinyin": "shū", "classifier": "本", "measure_example": "一本书 (yì běn shū)"}'
)
