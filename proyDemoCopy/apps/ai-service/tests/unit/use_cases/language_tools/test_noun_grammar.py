"""Tests 2026-11-03: regla obligatoria de vocabulario — cada sustantivo con artículo, género, plural o clasificador."""

import json

from src.modules.language_tools.application.use_cases.noun_grammar import NounGrammarRequest, NounGrammarUseCase
from src.modules.language_tools.domain.noun_grammar import NounGrammar, headword, missing, normalize


class FakeLlm:
    def __init__(self, reply: dict | None) -> None:
        self.reply = reply

    async def generate(self, *_a, **_k) -> str:
        if self.reply is None:
            raise RuntimeError("ollama caído")
        return json.dumps(self.reply)


async def run(term: str, language: str, reply: dict | None):
    return await NounGrammarUseCase(FakeLlm(reply)).execute(NounGrammarRequest(term=term, language=language))


async def test_aleman_articulo_por_genero_y_plural_sin_articulo():
    # El LLM equivoca el artículo y mete el artículo en el plural → el dominio lo corrige
    r = await run("Tisch", "de", {"is_noun": True, "lemma": "Tisch", "gender": "m", "article": "die", "plural": "die Tische"})
    assert r.headword == "der Tisch – die Tische" and r.missing == [] and r.checked


async def test_frances_l_ante_vocal_y_articulo_del_alumno():
    r = await run("la école", "fr", {"is_noun": True, "lemma": "école", "gender": "f", "plural": "écoles"})
    assert r.headword == "l'école – les écoles"


async def test_portugues_y_espanol():
    assert (await run("casa", "pt", {"is_noun": True, "gender": "f", "plural": "casas"})).headword == "a casa – as casas"
    assert (await run("libro", "es", {"is_noun": True, "gender": "m", "plural": "libros"})).headword == "el libro – los libros"


async def test_ingles_incontable_sin_articulo():
    r = await run("water", "en", {"is_noun": True, "countable": False, "article": "a"})
    assert r.headword == "water" and r.missing == []
    assert (await run("apple", "en", {"is_noun": True, "countable": True, "article": "an", "plural": "apples"})).headword == "an apple"


async def test_ruso_y_chino():
    assert (await run("стол", "ru", {"is_noun": True, "gender": "m", "plural": "столы"})).headword == "стол (m) – столы"
    r = await run("书", "zh", {"is_noun": True, "pinyin": "shū", "classifier": "本", "measure_example": "一本书"})
    assert r.headword == "一本书 (shū)" and r.missing == []


async def test_incompleto_y_llm_caido():
    assert (await run("Lampe", "de", {"is_noun": True})).missing == ["article", "gender", "plural"]
    down = await run("Lampe", "de", None)
    assert down.checked is False  # No se da por completa: NestJS la reintentará
    assert (await run("laufen", "de", {"is_noun": False})).missing == []


def test_dominio_puro():
    g = normalize("de", "Buch", NounGrammar(is_noun=True, gender="n", plural="Bücher"))
    assert headword("de", "Buch", g) == "das Buch – die Bücher" and missing("de", g) == []


# [2026-11-06]: lote → una sola llamada al LLM; cada término normalizado (artículo por género, plural) y los que falten sin marcar como revisados
async def test_lote_mismo_orden_y_respuesta_corta():
    from src.modules.language_tools.application.use_cases.noun_grammar import NounGrammarBatchRequest

    reply = {"items": [{"is_noun": True, "lemma": "Mutter", "gender": "f", "plural": "Mütter"}, {"is_noun": True, "lemma": "Kind", "gender": "n", "plural": "Kinder"}]}
    out = await NounGrammarUseCase(FakeLlm(reply)).execute_many(NounGrammarBatchRequest(terms=["Mutter", "das Kind", "Vater"], language="de"))
    assert [r.headword for r in out[:2]] == ["die Mutter – die Mütter", "das Kind – die Kinder"]
    assert out[2].checked is False and out[2].lemma == "Vater"
