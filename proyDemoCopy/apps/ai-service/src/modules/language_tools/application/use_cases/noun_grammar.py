"""Caso de uso: gramática obligatoria de un término del vocabulario (artículo, género, plural, clasificador…).

[Patrón]: Use Case (Query) | [Principio]: el LLM propone, el dominio normaliza y valida (`missing`) | [Paradigma]: Asíncrono.
"""

import re

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.modules.language_tools.application.use_cases.translate_text import LANGUAGE_NAMES
from src.modules.language_tools.domain.interfaces.llm_client import LlmPort
from src.modules.language_tools.domain.language_voices import LanguageCode
from src.modules.language_tools.domain.noun_grammar import SYSTEM_PROMPT, NounGrammar, headword, missing, normalize
from src.shared.clients.llm_json import generate_json

# Artículo que el alumno escribió delante («der Tisch», «l'école», «a book») → se separa del lema
_LEADING_ARTICLE = re.compile(r"^(?:der|die|das|le|la|les|l['’]|o|a|os|as|el|los|las|an|the)\s*(?=\S)", re.IGNORECASE)


class NounGrammarRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    term: str = Field(..., min_length=1, max_length=160)
    language: LanguageCode


class NounGrammarResponse(BaseModel):
    lemma: str
    grammar: NounGrammar
    headword: str  # Texto listo para la tarjeta
    missing: list[str]  # [] = completa; si no, la entrada queda pendiente de corregir
    checked: bool = True  # False = la IA no respondió → NestJS la reintenta más tarde (no se da por completa)


def strip_article(term: str, language: str) -> str:
    t = term.strip()
    if language in ("de", "fr", "pt", "es", "en") and len(t.split()) > 1 or t.lower().startswith(("l'", "l’")):
        return _LEADING_ARTICLE.sub("", t, count=1)
    return t


class NounGrammarBatchRequest(BaseModel):
    """[2026-11-06]: varios términos en UNA llamada al LLM (generadores de vocabulario, juegos y políglota) → la regla se aplica al generar sin multiplicar la espera."""

    model_config = ConfigDict(frozen=True, extra="forbid")
    terms: list[str] = Field(..., min_length=1, max_length=40)
    language: LanguageCode


# [Fix 2026-11-11 · lotes lentos]: con el prompt completo el modelo de CPU escribía pinyin/casos para TODOS los idiomas (~70 tokens por término:
# 4 sustantivos = 86 s) → 8 o más superaban el plazo de NestJS (100 s) y los mazos/políglota salían SIN artículo. Ahora solo los campos del idioma
# pedido; el artículo lo deriva `normalize` del género (más fiable que el que escribe el LLM).
_BATCH_FIELDS = {
    "de": '"gender": "m"|"f"|"n", "plural": plural sin artículo',
    "fr": '"gender": "m"|"f", "plural": plural sin artículo',
    "pt": '"gender": "m"|"f", "plural": plural sin artículo',
    "es": '"gender": "m"|"f", "plural": plural sin artículo',
    "ru": '"gender": "m"|"f"|"n", "plural": nominativo plural',
    "en": '"countable": true|false, "article": "a"|"an"|"" (incontable), "plural": plural',
    "zh": '"pinyin": pinyin con tonos, "classifier": clasificador, "measure_example": "一+clasificador+sustantivo (pinyin)"',
}


_BATCH_EXAMPLE = {
    "de": '1. Tisch 2. Lampe 3. Buch 4. laufen → {"items":[{"lemma":"Tisch","is_noun":true,"gender":"m","plural":"Tische"},{"lemma":"Lampe","is_noun":true,"gender":"f","plural":"Lampen"},{"lemma":"Buch","is_noun":true,"gender":"n","plural":"Bücher"},{"lemma":"laufen","is_noun":false}]}',
    "fr": '1. livre 2. maison 3. école → {"items":[{"lemma":"livre","is_noun":true,"gender":"m","plural":"livres"},{"lemma":"maison","is_noun":true,"gender":"f","plural":"maisons"},{"lemma":"école","is_noun":true,"gender":"f","plural":"écoles"}]}',
    "pt": '1. livro 2. casa → {"items":[{"lemma":"livro","is_noun":true,"gender":"m","plural":"livros"},{"lemma":"casa","is_noun":true,"gender":"f","plural":"casas"}]}',
    "es": '1. libro 2. mesa → {"items":[{"lemma":"libro","is_noun":true,"gender":"m","plural":"libros"},{"lemma":"mesa","is_noun":true,"gender":"f","plural":"mesas"}]}',
    "ru": '1. стол 2. книга 3. окно → {"items":[{"lemma":"стол","is_noun":true,"gender":"m","plural":"столы"},{"lemma":"книга","is_noun":true,"gender":"f","plural":"книги"},{"lemma":"окно","is_noun":true,"gender":"n","plural":"окна"}]}',
    "en": '1. book 2. apple 3. water → {"items":[{"lemma":"book","is_noun":true,"countable":true,"article":"a","plural":"books"},{"lemma":"apple","is_noun":true,"countable":true,"article":"an","plural":"apples"},{"lemma":"water","is_noun":true,"countable":false,"article":""}]}',
    "zh": '1. 书 2. 人 → {"items":[{"lemma":"书","is_noun":true,"pinyin":"shū","classifier":"本","measure_example":"一本书 (yì běn shū)"},{"lemma":"人","is_noun":true,"pinyin":"rén","classifier":"个","measure_example":"一个人 (yí ge rén)"}]}',
}


def batch_system(language: str) -> str:
    """Prompt corto del lote: solo los campos que exige el idioma + un ejemplo. Función pura."""
    return (
        "Eres un lexicógrafo experto. Recibirás VARIOS términos numerados. Devuelve SOLO JSON: {\"items\": [ ... ]} con UN objeto por término, "
        f'en el MISMO orden: {{"lemma": forma de diccionario en singular sin artículo, "is_noun": true|false, {_BATCH_FIELDS.get(language, "")}}}. '
        'Si NO es sustantivo: {"lemma": "...", "is_noun": false}. Comprueba el género real de cada palabra. '
        f"Ejemplo: {_BATCH_EXAMPLE.get(language, '')}"
    )


class NounGrammarUseCase:
    def __init__(self, llm: LlmPort) -> None:
        self._llm = llm

    async def execute_many(self, req: NounGrammarBatchRequest) -> list[NounGrammarResponse]:
        """Un objeto por término en el mismo orden | LLM caído o respuesta corta → `checked=False` en los que falten (el llamador conserva el término)."""
        lemmas = [strip_article(t, req.language) for t in req.terms]
        listing = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(lemmas))
        raw = await generate_json(
            self._llm,
            f"Idioma: {LANGUAGE_NAMES[req.language]}\nTérminos:\n{listing}",
            system=batch_system(req.language),
            max_tokens=min(60 + 50 * len(lemmas), 2000),
            temperature=0.1,
        )
        items = raw.get("items") if isinstance(raw, dict) else None
        items = items if isinstance(items, list) else []
        return [self._one(lemma, req.language, items[i] if i < len(items) and isinstance(items[i], dict) else None) for i, lemma in enumerate(lemmas)]

    def _one(self, lemma: str, language: str, data: dict | None) -> NounGrammarResponse:
        """Normaliza la propuesta del LLM para un término (misma lógica que `execute`). Función pura salvo validación."""
        if len(lemma.split()) > 3:
            return NounGrammarResponse(lemma=lemma, grammar=NounGrammar(), headword=lemma, missing=[])
        if data is None:
            return NounGrammarResponse(lemma=lemma, grammar=NounGrammar(), headword=lemma, missing=[], checked=False)
        data = dict(data)
        lemma = strip_article(str(data.pop("lemma", "") or lemma).strip() or lemma, language)
        try:
            g = NounGrammar.model_validate({k: v for k, v in data.items() if k in NounGrammar.model_fields})
        except ValidationError:
            g = NounGrammar(is_noun=bool(data.get("is_noun")))
        g = normalize(language, lemma, g)
        return NounGrammarResponse(lemma=lemma, grammar=g, headword=headword(language, lemma, g), missing=missing(language, g))

    async def execute(self, req: NounGrammarRequest) -> NounGrammarResponse:
        lemma = strip_article(req.term, req.language)
        if len(lemma.split()) > 3:  # Frase, no un sustantivo
            return NounGrammarResponse(lemma=lemma, grammar=NounGrammar(), headword=lemma, missing=[])
        raw = await generate_json(self._llm, f"Idioma: {LANGUAGE_NAMES[req.language]}\nTérmino: {lemma}", system=SYSTEM_PROMPT, max_tokens=220, temperature=0.1)
        if raw is None:
            return NounGrammarResponse(lemma=lemma, grammar=NounGrammar(), headword=lemma, missing=[], checked=False)
        data = dict(raw)
        lemma = str(data.pop("lemma", "") or lemma).strip() or lemma
        try:
            g = NounGrammar.model_validate({k: v for k, v in data.items() if k in NounGrammar.model_fields})
        except ValidationError:
            g = NounGrammar(is_noun=bool(data.get("is_noun")))  # Datos basura → se marca como sustantivo incompleto (se reintentará)
        g = normalize(req.language, lemma, g)
        return NounGrammarResponse(lemma=lemma, grammar=g, headword=headword(req.language, lemma, g), missing=missing(req.language, g))
