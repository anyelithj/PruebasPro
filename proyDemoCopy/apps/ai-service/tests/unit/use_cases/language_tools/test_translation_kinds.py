"""Paso 4 · Traducción (Caso C): tipo_de_texto (frase/título/expresión), glosario curado en 7 idiomas, signos ¿¡ completos,
contexto de la conversación y caché por (texto, idioma, tipo) con temperatura baja.

El LLM es un doble que cuenta llamadas y guarda el prompt | [Patrón]: Test Double (Spy) + Table-Driven.
"""

import json

import pytest

from src.modules.language_tools.application.schemas.translate_request import TranslateRequest
from src.modules.language_tools.application.use_cases.translate_text import DETERMINISTIC, TranslateTextUseCase
from src.modules.language_tools.infrastructure.translation_cache import TranslationCache


class SpyLlm:
    def __init__(self, *answers: object) -> None:
        self.answers = list(answers)
        self.calls: list[dict[str, object]] = []

    async def generate(self, prompt: str, **kw: object) -> str:
        self.calls.append({"prompt": prompt, **kw})
        a = self.answers.pop(0) if self.answers else {}
        return json.dumps(a)


def uc(llm: SpyLlm) -> TranslateTextUseCase:
    return TranslateTextUseCase(llm, "qwen2.5:3b", TranslationCache())  # type: ignore[arg-type]


async def test_caso_c_titulo_hands_to_myself_tres_opciones_sin_llm() -> None:
    llm = SpyLlm()
    res = await uc(llm).execute(TranslateRequest(text="Hands To Myself", source="en", tipo_de_texto="titulo"))
    assert [(o.tipo, o.texto) for o in res.options] == [
        ("natural", "No puedo contenerme"),
        ("cercana", "No puedo mantener mis manos quietas"),
        ("literal", "Mis manos para mí"),
    ]
    assert res.translation == "No puedo contenerme"  # La recomendada = natural (nunca «Manos a mí»)
    assert res.model == DETERMINISTIC and llm.calls == []


async def test_expresion_nueva_con_llm_ordena_opciones_completa_signos_y_cachea_por_tipo() -> None:
    llm = SpyLlm({"literal": "Golpea el saco", "natural": "Me voy a dormir!", "cercana": "Voy a acostarme"}, {"translation": "Golpea el saco."})
    u = uc(llm)
    req = TranslateRequest(text="Hit the sack", source="en", tipo_de_texto="expresion")
    first = await u.execute(req)
    assert [o.tipo for o in first.options] == ["natural", "cercana", "literal"]
    assert first.translation == "¡Me voy a dormir!"  # «¡» de apertura completado
    again = await u.execute(req)
    assert again.translation == first.translation and again.model == "cache" and len(llm.calls) == 1  # Misma entrada → misma salida, sin LLM
    await u.execute(TranslateRequest(text="Hit the sack", source="en"))  # «frase»: otra entrada de caché (no reutiliza las opciones)
    assert len(llm.calls) == 2
    assert all(float(c["temperature"]) <= 0.1 for c in llm.calls)  # type: ignore[arg-type]  # Temperatura baja: traducción estable


async def test_caso_c_nice_to_meet_you_suena_humano_y_lleva_signos_completos() -> None:
    llm = SpyLlm({"translation": "Mucho gusto, Laura! Qué bueno que eres de Colombia."})
    u = uc(llm)
    assert (await u.execute(TranslateRequest(text="Nice to meet you!", source="en"))).translation == "¡Mucho gusto!"  # Sin LLM
    res = await u.execute(TranslateRequest(text="Nice to meet you, Laura! It's great that you're from Colombia.", source="en"))
    assert res.translation.startswith("¡Mucho gusto, Laura!")  # «¡» añadido aunque el modelo lo olvidó


async def test_contexto_de_la_conversacion_viaja_en_el_prompt_pero_no_cambia_la_cache() -> None:
    llm = SpyLlm({"translation": "Me llamo Laura."})
    u = uc(llm)
    await u.execute(TranslateRequest(text="My name is Laura.", source="en", context="What's your name?"))
    assert "What's your name?" in str(llm.calls[0]["prompt"]) and "NO lo traduzcas" in str(llm.calls[0]["prompt"])
    await u.execute(TranslateRequest(text="My name is Laura.", source="en", context="Otra cosa"))
    assert len(llm.calls) == 1  # Caché por (texto, idioma, tipo): la misma frase da siempre la misma traducción


@pytest.mark.parametrize(
    ("word", "source", "expected"),
    [("niece", "en", "sobrina"), ("nephew", "en", "sobrino"), ("granddaughter", "en", "nieta"), ("nièce", "fr", "sobrina"),
     ("Neffe", "de", "Sobrino"), ("sobrinha", "pt", "sobrina"), ("племянница", "ru", "sobrina"), ("外甥", "zh", "sobrino")],
)  # fmt: skip
async def test_glosario_de_parentesco_en_los_7_idiomas_sin_llm(word: str, source: str, expected: str) -> None:
    llm = SpyLlm()
    res = await uc(llm).execute(TranslateRequest(text=word, source=source))  # type: ignore[arg-type]
    assert res.translation == expected and llm.calls == []


async def test_glosario_en_el_prompt_y_salida_que_lo_ignora_se_rechaza() -> None:
    llm = SpyLlm({"translation": "Mi prima es Laura."}, {"translation": "Mi sobrina es Laura."})
    res = await uc(llm).execute(TranslateRequest(text="My niece is Laura.", source="en"))
    assert "«niece» → «sobrina»" in str(llm.calls[0]["system"])
    assert res.translation == "Mi sobrina es Laura."  # «prima» no pasa el control del glosario → reintento


@pytest.mark.parametrize(("text", "source", "natural"), [("il pleut des cordes", "fr", "Está lloviendo a cántaros"), ("Daumen drücken", "de", "Cruzar los dedos"),
                                                         ("pagar o pato", "pt", "Pagar los platos rotos"), ("Ни пуха ни пера", "ru", "¡Mucha suerte!"), ("加油", "zh", "¡Ánimo!")])  # fmt: skip
async def test_expresiones_curadas_en_otros_idiomas(text: str, source: str, natural: str) -> None:
    res = await uc(SpyLlm()).execute(TranslateRequest(text=text, source=source, tipo_de_texto="expresion"))  # type: ignore[arg-type]
    assert res.translation == natural and len(res.options) == 3


async def test_tarea_9_la_traduccion_recibe_frases_revisadas_del_rag_y_deja_traza() -> None:
    async def refs(text: str, source: str, level: str | None) -> list[tuple[str, str]]:
        return [("frase-7", "Nice to meet you = Mucho gusto [fuente: Saludos]")]

    llm = SpyLlm({"translation": "¡Mucho gusto! Soy de Colombia."})
    use_case = TranslateTextUseCase(llm, "qwen2.5:3b", TranslationCache(), refs)  # type: ignore[arg-type]
    res = await use_case.execute(TranslateRequest(text="Nice to meet you! I am from Colombia, and I like it.", source="en"))
    assert "REFERENCIAS" in str(llm.calls[0]["prompt"]) and "Mucho gusto" in str(llm.calls[0]["prompt"])
    assert res.references == ["frase-7"]


async def test_tarea_9_sin_material_o_rag_caido_traduce_igual() -> None:
    async def broken(*_: object) -> list[tuple[str, str]]:
        raise RuntimeError("caído")

    llm = SpyLlm({"translation": "Me gusta leer libros por la noche."})
    res = await TranslateTextUseCase(llm, "qwen2.5:3b", TranslationCache(), broken).execute(  # type: ignore[arg-type]
        TranslateRequest(text="I like reading books at night.", source="en")
    )
    assert "REFERENCIAS" not in str(llm.calls[0]["prompt"]) and res.references == [] and res.translation
