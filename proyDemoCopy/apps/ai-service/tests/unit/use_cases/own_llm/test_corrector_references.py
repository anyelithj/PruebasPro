"""Tarea 6/9 · Anexo A regla 11: el corrector con y sin «referencias» sigue devolviendo JSON válido del Anexo A y deja traza de los fragmentos.

[Patrón]: Test Double (LLM guionizado + RAG falso) | El texto de las referencias es propio (sin contenido de terceros).
"""

import json

from src.modules.own_llm.application.schemas.corrector_io import CorrectorInput, CorrectorOutput
from src.modules.own_llm.application.use_cases.correct_sentence import CorrectSentenceUseCase

REF = "Artículos a / an: «a» va antes de sonido de consonante y «an» antes de sonido de vocal (an apple, a university). [fuente: Artículos]"
INPUT = CorrectorInput(pregunta_previa="What do you have for breakfast?", texto="I have a apple.", tema="comida")
OUT = {  # EJEMPLO 4 del Anexo A
    "frase_corregida": "I have an apple.", "veredicto": "con_errores",
    "errores": [{"categoria": "gramatica", "original": "a apple", "sugerencia": "an apple", "explicacion": "«Apple» empieza con sonido de vocal."}],
    "traduccion": "Tengo una manzana.", "alternativas_traduccion": [], "comentario": "Muy bien; solo cambia «a» por «an».",
}  # fmt: skip


class RecordingLlm:
    def __init__(self) -> None:
        self.prompts: list[dict] = []

    async def generate(self, prompt: str, **_: object) -> str:
        self.prompts.append(json.loads(prompt))  # La entrada debe ser JSON del Anexo A
        return json.dumps(OUT)


async def _refs(query: str, language: str, level: str) -> list[tuple[str, str]]:
    assert "a apple" in query and language == "en" and level == "A1"
    return [("art-1", REF)]


async def _none(*_: object) -> list[tuple[str, str]]:
    return []


async def test_con_referencias_del_rag_el_modelo_las_recibe_y_la_salida_es_valida() -> None:
    llm = RecordingLlm()
    res = await CorrectSentenceUseCase(llm, ("m",), references=_refs).execute(INPUT)
    assert llm.prompts[0]["referencias"] == [REF]
    assert res.referencias_usadas == ["art-1"]  # RNF-35: qué fragmentos respaldaron la corrección
    CorrectorOutput.model_validate(res.correccion.model_dump())  # Sigue siendo el JSON estricto del Anexo A
    assert res.correccion.frase_corregida == "I have an apple." and res.correccion.veredicto == "con_errores"


async def test_sin_referencias_no_se_envia_el_campo_y_la_salida_es_valida() -> None:
    llm = RecordingLlm()
    res = await CorrectSentenceUseCase(llm, ("m",), references=_none).execute(INPUT)
    assert "referencias" not in llm.prompts[0] and res.referencias_usadas == []
    CorrectorOutput.model_validate(res.correccion.model_dump())


async def test_referencias_del_cliente_tienen_prioridad_y_maximo_cinco() -> None:
    llm = RecordingLlm()
    req = INPUT.model_copy(update={"referencias": ["propia"]})
    await CorrectSentenceUseCase(llm, ("m",), references=_refs).execute(req)
    assert llm.prompts[0]["referencias"] == ["propia"]
    try:
        CorrectorInput(texto="x", referencias=["r"] * 6)
        raise AssertionError("debió rechazar 6 referencias")
    except ValueError:
        pass


async def test_si_el_rag_falla_la_correccion_sigue() -> None:
    async def broken(*_: object) -> list[tuple[str, str]]:
        raise RuntimeError("índice caído")

    res = await CorrectSentenceUseCase(RecordingLlm(), ("m",), references=broken).execute(INPUT)
    assert res.correccion.frase_corregida == "I have an apple."
