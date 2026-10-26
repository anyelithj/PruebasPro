"""Pruebas 2026-10-25 · traducciones de «Temas de conversación» y «Biblioteca de diálogos» con las cadenas EXACTAS del reporte.

[Patrón]: Test Double (LLM falso con respuestas en cola) + AAA | [Principio]: deterministas, sin Ollama.
"""

import json

from src.modules.language_tools.application.schemas.lines_request import LinesRequest
from src.modules.language_tools.application.schemas.translate_request import TranslateRequest
from src.modules.language_tools.application.use_cases.enrich_lines import EnrichLinesUseCase
from src.modules.language_tools.application.use_cases.translate_text import DETERMINISTIC, UNAVAILABLE, TranslateTextUseCase
from src.modules.language_tools.domain.translation_rules import is_acceptable, normalize_spanish, quick_translation
from src.modules.language_tools.infrastructure.translation_cache import TranslationCache
from src.shared.domain.llm_output import looks_like_json, parse_translation

SRC_MEAT = "I like ground meat spicy, with vegetables served in little tacos."
RAW_MEAT = '{"I like ground meat spicy, with vegetables served in little tacos.": "Me gusta el carne molida picante, con verduras servidas en taquitos."}'
RAW_ARRAY = '["Incluye tomate, pimientos rojos y verdes, cebolla y cilantro.",]'


class QueueLlm:
    """LLM falso: devuelve las respuestas en orden (dict → JSON; str → tal cual) y guarda los prompts de sistema."""

    def __init__(self, *replies: object) -> None:
        self.replies, self.calls, self.systems = list(replies), 0, []

    async def generate(self, prompt: str, **kw: object) -> str:
        self.calls += 1
        self.systems.append(str(kw.get("system", "")))
        reply = self.replies.pop(0) if self.replies else None
        if reply is None:
            raise RuntimeError("Ollama caído")
        return reply if isinstance(reply, str) else json.dumps(reply, ensure_ascii=False)


class FakePhonetizer:
    engine = "fake"

    async def ipa_words(self, words: list[str], voice: str) -> list[str]:
        return [f"/{w}/" for w in words]


# ───── Parser tolerante ─────


def test_json_crudo_con_la_frase_como_clave_devuelve_el_valor():
    assert parse_translation(RAW_MEAT, SRC_MEAT) == "Me gusta el carne molida picante, con verduras servidas en taquitos."


def test_lista_con_coma_colgante_se_desenvuelve():
    assert parse_translation(RAW_ARRAY) == "Incluye tomate, pimientos rojos y verdes, cebolla y cilantro."


def test_vallas_comillas_y_json_truncado():
    assert parse_translation('```json\n{"translation": "«Hola»"}\n```') == "Hola"
    assert parse_translation('{"translation": "Me gusta la salsa."') == "Me gusta la salsa."  # Sin «}»: se rescata la cadena cerrada
    assert parse_translation('{"translation": "Me gusta la sal') is None  # Cortada a mitad: incompleta → no se muestra
    assert parse_translation(["¿Prefieres tacos?"]) == "¿Prefieres tacos?"  # Lista de un elemento
    assert parse_translation({"translation": {"text": "Sí"}}) == "Sí"


def test_lo_que_sigue_pareciendo_json_se_rechaza_y_el_texto_entre_corchetes_no():
    assert parse_translation('"translation": "x", "register"') is None
    assert looks_like_json('{"a": 1') and not looks_like_json("[Estribillo] la la la")
    assert parse_translation("[Estribillo] la la la") == "[Estribillo] la la la"


# ───── Reglas deterministas ─────


def test_respuestas_cortas_sin_llm():
    assert quick_translation("yes", "en") == "sí" and quick_translation("Yes!", "en") == "¡Sí!"
    assert quick_translation("Bell pepper", "en") == "Pimiento morrón"  # Antes «Pepino verde»


def test_espanol_neutro_sin_voseo_y_con_concordancia():
    assert normalize_spanish("¿Preferís el carne picante?") == "¿Prefieres la carne picante?"
    assert normalize_spanish("Después de inglés, vos sos genial") == "Después de inglés, tú eres genial"  # «después», «inglés» intactos


def test_control_de_calidad_con_las_traducciones_del_reporte():
    assert not is_acceptable("yes", "yes", "en")  # Sin traducir
    assert not is_acceptable("Jalapeños, olives, onions", "jalones, aguacates, alubias", "en")  # Glosario ignorado
    assert not is_acceptable("I love rooster's beak", "Me encanta la cabeza de gallo", "en")
    assert not is_acceptable("I love rooster’s beak", "Me encanta la pata del gallo", "en")  # Apóstrofo tipográfico
    assert is_acceptable("I love rooster's beak", "Me encanta el pico de gallo", "en")
    assert not is_acceptable("I like it a lot with my family", "I like it a lot with my family", "en")
    assert is_acceptable("Mexico City", "Mexico City", "en")  # Nombre propio: idéntico es válido


# ───── Caso de uso ─────


async def test_traduccion_json_cruda_se_limpia_y_corrige():
    llm = QueueLlm(RAW_MEAT)
    res = await TranslateTextUseCase(llm, "m").execute(TranslateRequest(text=SRC_MEAT, source="en"))
    assert res.translation == "Me gusta la carne molida picante, con verduras servidas en taquitos." and llm.calls == 1
    assert "carne molida" in llm.systems[0]  # Glosario inyectado en el prompt


async def test_yes_no_llama_al_llm():
    llm = QueueLlm()
    res = await TranslateTextUseCase(llm, "m").execute(TranslateRequest(text="yes", source="en"))
    assert res.translation == "sí" and res.model == DETERMINISTIC and llm.calls == 0


async def test_mala_traduccion_reintenta_una_vez_y_si_insiste_queda_no_disponible():
    bad = {"translation": "jalones, aguacates, alubias"}
    llm = QueueLlm(bad, bad)
    res = await TranslateTextUseCase(llm, "m").execute(TranslateRequest(text="jalapeños, olives, onions", source="en"))
    assert llm.calls == 2 and res.translation == "" and res.model == UNAVAILABLE
    assert "IMPORTANTE" in llm.systems[1]  # El reintento lleva la orden estricta
    ok = QueueLlm(bad, {"translation": "jalapeños, aceitunas, cebollas"})
    assert (await TranslateTextUseCase(ok, "m").execute(TranslateRequest(text="jalapeños, olives, onions", source="en"))).translation == "jalapeños, aceitunas, cebollas"


async def test_cache_evita_la_segunda_llamada():
    llm = QueueLlm({"translation": "Me gusta el pico de gallo"})
    uc = TranslateTextUseCase(llm, "m", TranslationCache())
    for _ in range(2):
        res = await uc.execute(TranslateRequest(text="I like rooster's beak", source="en"))
    assert res.translation == "Me gusta el pico de gallo" and llm.calls == 1


async def test_lineas_del_reporte_en_lote_limpian_json_y_rellenan_lo_dudoso():
    # Lote: la 1.ª llega como JSON {"<frase>": "<traducción>"}, la 2.ª como lista con coma colgante, «yes» sin LLM,
    # «Bell pepper» sin LLM (glosario) y la 4.ª mal traducida → respaldo una a una (bien a la segunda)
    lines = [SRC_MEAT, "It includes tomato, red and green peppers, onion and cilantro.", "yes", "Bell pepper", "I add jalapeños, olives, onions."]
    batch = {"translations": [RAW_MEAT, RAW_ARRAY, "Agrego jalones, aguacates, alubias."]}
    llm = QueueLlm(batch, {"translation": "Agrego jalapeños, aceitunas, cebollas."})
    out = await EnrichLinesUseCase(TranslateTextUseCase(llm, "m"), FakePhonetizer()).execute(LinesRequest(lines=lines, language="en"))
    assert [x.translation for x in out.lines] == [
        "Me gusta la carne molida picante, con verduras servidas en taquitos.",
        "Incluye tomate, pimientos rojos y verdes, cebolla y cilantro.",
        "sí",
        "Pimiento morrón",
        "Agrego jalapeños, aceitunas, cebollas.",
    ]
    assert llm.calls == 2  # Un lote (3 líneas) + una línea de respaldo


async def test_lote_como_diccionario_por_frase():
    llm = QueueLlm({"Where do you live?": "¿Dónde vives?", "Do you like it?": "¿Te gusta?"})
    out = await EnrichLinesUseCase(TranslateTextUseCase(llm, "m"), FakePhonetizer()).execute(
        LinesRequest(lines=["Where do you live?", "Do you like it?"], language="en")
    )
    assert [x.translation for x in out.lines] == ["¿Dónde vives?", "¿Te gusta?"] and llm.calls == 1
