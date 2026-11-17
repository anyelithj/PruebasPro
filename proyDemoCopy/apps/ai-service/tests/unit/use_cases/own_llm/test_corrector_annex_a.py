"""Corrector pedagógico único (Anexo A): Caso A, validación Pydantic, reintento → modelo base → reglas, veredicto y puntuación coherentes.

El LLM se sustituye por un doble con respuestas guionizadas (sin Ollama) | [Patrón]: Test Double (Stub) + Table-Driven.
"""

import json

import pytest

from src.modules.own_llm.application.schemas.corrector_io import CorrectorInput
from src.modules.own_llm.application.use_cases.correct_sentence import RULES_ONLY, CorrectSentenceUseCase
from src.modules.own_llm.prompts import CORRECTOR_PROMPT, CORRECTOR_PROMPT_VERSION
from src.shared.exceptions.custom_errors import ModelInferenceError

ASK = "Hi! I'm Aula. What's your name, and where are you from?"
CASE_A = CorrectorInput(pregunta_previa=ASK, texto="my niece is Laura I'm on from Columbia", idioma="en", nivel="A1", tema="presentarse", origen="voz")
# Salida del EJEMPLO 1 del Anexo A (lo que devolvería un modelo bien ajustado)
EXAMPLE_1 = {
    "frase_corregida": "My name is Laura. I'm from Colombia.", "veredicto": "con_errores",
    "errores": [
        {"categoria": "posible_error_de_transcripcion", "original": "niece", "sugerencia": "name", "explicacion": "Aula preguntó tu nombre."},
        {"categoria": "mayuscula", "original": "my", "sugerencia": "My", "explicacion": "Mayúscula inicial."},
        {"categoria": "puntuacion", "original": "Laura I'm", "sugerencia": "Laura. I'm", "explicacion": "Cada oración termina con punto."},
        {"categoria": "gramatica", "original": "I'm on from", "sugerencia": "I'm from", "explicacion": "«on» sobra."},
        {"categoria": "ortografia", "original": "Columbia", "sugerencia": "Colombia", "explicacion": "El país es Colombia."},
    ],
    "traduccion": "Me llamo Laura. Soy de Colombia.", "alternativas_traduccion": [], "comentario": "Casi lo tienes; repite la frase corregida en voz alta.",
}  # fmt: skip


class ScriptedLlm:
    """Devuelve las respuestas en orden; una excepción en la lista se lanza (modelo caído)."""

    def __init__(self, *answers: object) -> None:
        self.answers = list(answers)
        self.models: list[str | None] = []

    async def generate(self, prompt: str, **kw: object) -> str:
        self.models.append(kw.get("model"))  # type: ignore[arg-type]
        assert kw.get("system") == CORRECTOR_PROMPT  # El prompt del Anexo A, tal cual
        assert json.loads(prompt)["texto"]  # La entrada viaja como JSON del Anexo A
        a = self.answers.pop(0) if self.answers else ModelInferenceError("caído")
        if isinstance(a, Exception):
            raise a
        return a if isinstance(a, str) else json.dumps(a)


class FakeTranslator:
    async def translate_line(self, text: str, source: str, context: str = "") -> str | None:
        return {"My name is Laura. I'm from Colombia.": "me llamo Laura. soy de Colombia"}.get(text)


def uc(llm: ScriptedLlm) -> CorrectSentenceUseCase:
    return CorrectSentenceUseCase(llm, ("aula-corrector", "qwen2.5:3b"), FakeTranslator())


async def test_caso_a_exacto_con_el_modelo() -> None:
    res = await uc(ScriptedLlm(EXAMPLE_1)).execute(CASE_A)
    c = res.correccion
    assert c.frase_corregida == "My name is Laura. I'm from Colombia."
    assert c.traduccion == "Me llamo Laura. Soy de Colombia."
    assert c.veredicto == "con_errores" and c.alternativas_traduccion == []
    assert {e.categoria for e in c.errores} == {"posible_error_de_transcripcion", "mayuscula", "puntuacion", "gramatica", "ortografia"}
    assert ("Laura I'm", "Laura. I'm") in {(e.original, e.sugerencia) for e in c.errores}  # Punto entre oraciones, legible
    assert res.puntuacion < 100 and res.modelo == "aula-corrector" and not res.respaldo
    assert res.version_prompt == CORRECTOR_PROMPT_VERSION


async def test_caso_a_sin_llm_las_reglas_dan_la_misma_frase_y_la_traduccion_sale_de_languagetools() -> None:
    res = await uc(ScriptedLlm(ModelInferenceError("x"), ModelInferenceError("x"), ModelInferenceError("x"))).execute(CASE_A)
    assert res.correccion.frase_corregida == "My name is Laura. I'm from Colombia."
    assert res.correccion.traduccion == "Me llamo Laura. Soy de Colombia."  # ¡Mayúsculas y punto añadidos por las reglas del español!
    assert res.modelo == RULES_ONLY and res.respaldo and res.correccion.veredicto == "con_errores"


async def test_json_invalido_reintenta_una_vez_y_luego_usa_el_modelo_base() -> None:
    llm = ScriptedLlm("no es json", {"frase_corregida": "x", "veredicto": "correcta", "errores": [{"categoria": "gramatica", "original": "a", "sugerencia": "b", "explicacion": "c"}]}, EXAMPLE_1)
    res = await uc(llm).execute(CASE_A)
    assert llm.models == ["aula-corrector", "aula-corrector", "qwen2.5:3b"]  # Inválido → reintento (incoherente) → base
    assert res.modelo == "qwen2.5:3b" and res.respaldo
    assert res.correccion.frase_corregida == "My name is Laura. I'm from Colombia."


async def test_nunca_100_ni_correcta_si_hay_errores_aunque_el_modelo_diga_correcta() -> None:
    lazy = {"frase_corregida": "i am from columbia", "veredicto": "correcta", "errores": [], "traduccion": "Soy de Colombia.", "comentario": "¡Muy bien!"}
    res = await uc(ScriptedLlm(lazy)).execute(CorrectorInput(texto="i am from columbia", idioma="en"))
    assert res.correccion.veredicto == "con_errores" and res.puntuacion <= 90
    assert res.correccion.frase_corregida == "I am from Colombia."
    assert res.correccion.comentario != "¡Muy bien!"  # El comentario del modelo era para «correcta»


async def test_frase_correcta_da_100() -> None:
    ok = {"frase_corregida": "Yes, I like music very much.", "veredicto": "correcta", "errores": [], "traduccion": "Sí, me gusta mucho la música.", "comentario": "¡Muy bien dicho!"}
    res = await uc(ScriptedLlm(ok)).execute(CorrectorInput(pregunta_previa="Do you like music?", texto="Yes, I like music very much.", nivel="A2"))
    assert (res.correccion.veredicto, res.puntuacion, res.correccion.errores) == ("correcta", 100, [])


async def test_error_inventado_que_no_esta_en_el_texto_se_descarta() -> None:
    invented = {**EXAMPLE_1, "errores": [*EXAMPLE_1["errores"], {"categoria": "vocabulario", "original": "beautiful", "sugerencia": "pretty", "explicacion": "x"}]}  # type: ignore[list-item]
    res = await uc(ScriptedLlm(invented)).execute(CASE_A)
    assert all(e.original != "beautiful" for e in res.correccion.errores)


@pytest.mark.parametrize("kind", ["expresion", "titulo"])
async def test_expresiones_y_titulos_tienen_tres_alternativas_y_la_recomendada(kind: str) -> None:
    out = {"frase_corregida": "It's raining cats and dogs.", "veredicto": "correcta", "errores": [], "traduccion": "x",
           "alternativas_traduccion": [{"tipo": "literal", "texto": "Está lloviendo gatos y perros."}, {"tipo": "natural", "texto": "Está lloviendo a cántaros."},
                                       {"tipo": "cercana", "texto": "Está lloviendo muchísimo."}]}  # fmt: skip
    res = await uc(ScriptedLlm(out)).execute(CorrectorInput(texto="It's raining cats and dogs.", tipo_de_texto=kind))  # type: ignore[arg-type]
    assert [a.tipo for a in res.correccion.alternativas_traduccion] == ["natural", "cercana", "literal"]
    assert res.correccion.traduccion == "Está lloviendo a cántaros."


async def test_en_frase_las_alternativas_quedan_vacias() -> None:
    out = {**EXAMPLE_1, "alternativas_traduccion": [{"tipo": "literal", "texto": "Mi sobrina es Laura"}]}
    res = await uc(ScriptedLlm(out)).execute(CASE_A)
    assert res.correccion.alternativas_traduccion == []


def test_prompt_versionado_es_el_del_anexo_a() -> None:
    assert CORRECTOR_PROMPT.startswith("Eres el corrector pedagógico de Aula de Idiomas.") and "/no_think" in CORRECTOR_PROMPT
    assert all(f"\n{n}. " in CORRECTOR_PROMPT for n in range(1, 11))  # Las 10 reglas
    assert CORRECTOR_PROMPT_VERSION.startswith("corrector_system@") and len(CORRECTOR_PROMPT_VERSION) == len("corrector_system@") + 12
