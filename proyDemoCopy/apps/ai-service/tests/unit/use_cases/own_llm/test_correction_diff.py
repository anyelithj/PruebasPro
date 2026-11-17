"""Tests 2026-10-27: corrector estilo GrammarMama — hallazgos por diff (difflib), merge con los del LLM y «Detectar idioma».

[Patrón]: Test Double (FakeLlm) + AAA.
[Principio]: las posiciones las calcula el servidor; el diff solo rellena lo que el LLM no listó.
"""

import json

from src.modules.own_llm.application.schemas.writing_request import WritingRequest
from src.modules.own_llm.application.use_cases.correct_writing import CorrectWritingUseCase
from src.modules.own_llm.domain.correction_diff import diff_findings, merge_findings
from src.modules.own_llm.infrastructure.models.writing_corrector_model import WritingCorrectorModel, parse_draft
from src.shared.domain.error_finding import ErrorFinding


def spans(findings):
    return [(f.type.value, f.original, f.correction, f.start, f.end) for f in findings]


def test_diff_marca_ortografia_gramatica_y_puntuacion_con_offsets():
    text = "i recieve the letter yesterday and i go home"
    fixed = "I received the letter yesterday, and I went home."
    found = diff_findings(text, fixed)
    assert all(text[f.start : f.end] == f.original for f in found)  # Offsets exactos sobre el original
    kinds = {f.original: f.type.value for f in found}
    assert kinds["i"] == "capitalization"  # [2026-10-28]: Mayúsculas es su propia categoría (antes «punctuation»)
    assert kinds["recieve"] == "spelling"  # recieve → received: misma inicial y casi iguales
    assert kinds["go"] == "grammar"
    assert any(f.correction == "yesterday," for f in found)  # Coma que falta → anclada a la palabra anterior
    assert any(f.original == "home" and f.correction == "home." for f in found)


def test_diff_ortografia_simple():
    [f] = diff_findings("I have a frend", "I have a friend")
    assert (f.type.value, f.original, f.correction, f.start, f.end) == ("spelling", "frend", "friend", 9, 14)


def test_diff_orden_de_palabras():
    text = "I like very much pizza"
    found = diff_findings(text, "I like pizza very much")
    assert found and all(text[f.start : f.end] == f.original for f in found)  # difflib lo ve como mover «pizza»


def test_diff_descarta_correcciones_desbocadas_o_traducidas():
    assert diff_findings("She go to school.", "Ella va a la escuela.") == []


def test_merge_prioriza_al_llm_y_ordena():
    llm = [ErrorFinding(type="grammar", original="go", correction="goes", explanation_es="3.ª persona", start=4, end=6)]
    extra = diff_findings("She go to school", "She goes to school.")
    merged = merge_findings(llm, extra)
    assert merged[0].explanation_es == "3.ª persona"  # El del LLM gana (explicación pedagógica)
    assert spans(merged)[1] == ("punctuation", "school", "school.", 10, 16)


def test_parse_draft_completa_lo_que_el_llm_no_listo():
    raw = json.dumps({"findings": [{"type": "grammar", "original": "go", "correction": "goes", "explanation_es": "x"}], "corrected_text": "She goes to school, every day."})
    draft = parse_draft(raw, "She go to school every day", "en")
    assert [(f.original, f.correction) for f in draft.findings] == [("go", "goes"), ("school", "school,"), ("day", "day.")]


class FakeLlm:
    def __init__(self, reply: str) -> None:
        self.reply, self.prompts = reply, []

    async def generate(self, prompt: str, **_: object) -> str:
        self.prompts.append(prompt)
        return self.reply


async def test_auto_detecta_el_idioma_y_lo_informa():
    reply = json.dumps({"findings": [], "corrected_text": "Je vais au cinéma.", "explanation_es": "ok"})
    llm = FakeLlm(reply)
    uc = CorrectWritingUseCase(WritingCorrectorModel(llm, ("aula-corrector", "base")))
    res = await uc.execute(WritingRequest(text="Je allez au cinéma", language="auto"))
    assert res.language == "fr" and res.detected_language == "fr"
    assert "Language: French" in llm.prompts[0]
    assert res.model_used == "base" and not res.fallback_used  # Francés → modelo base directo (no cuenta como respaldo)
    assert ("allez", "vais") in [(f.original, f.correction) for f in res.findings]  # El diff marca lo que el LLM no listó


# [2026-10-28 · Estilo GrammarMama]: categoría «Mayúsculas» + explicación por error SIEMPRE en español
def test_grammarmama_mayusculas_y_explicacion_siempre_en_espanol():
    raw = json.dumps(
        {
            "findings": [
                {"type": "spelling", "original": "i m", "correction": "I'm", "explanation_es": "La contracción de 'I am' necesita un apóstrofo: 'I'm'."},
                {"type": "Capitalization", "original": "ana", "correction": "Ana", "explanation_es": "Proper nouns are always written with a capital letter."},
            ],
            "corrected_text": "I'm Ana",
            "explanation_es": "Revisa las mayúsculas.",
        }
    )
    found = parse_draft(raw, "i m ana", "en").findings
    # [2026-11-02 · GrammarMama]: las reglas del inglés separan «i → I» (Mayúsculas) y «m → 'm» (Puntuación) + punto final
    assert [(f.original, f.correction, f.type.value) for f in found] == [("i", "I", "capitalization"), ("m", "'m", "punctuation"), ("ana", "Ana.", "capitalization")]
    assert "apóstrofo" in found[1].explanation_es
    assert found[2].explanation_es.startswith("Los nombres propios se escriben con mayúscula inicial.")  # Regla por posición, no la del LLM


# [Fix 2026-10-30]: el LLM solo listó «i m» pero corrigió también «ana» (salida real de qwen2.5:3b) → la explicación de «Ana» no puede perderse
def test_lo_que_el_llm_olvida_con_i_m_ana():
    raw = json.dumps({"findings": [{"type": "spelling", "original": "i m", "correction": "I'm", "explanation_es": "El pronombre 'I' lleva mayúscula."}], "corrected_text": "I'm Ana"})
    found = parse_draft(raw, "i m ana", "en").findings
    assert [(f.original, f.correction, f.type.value, f.start, f.end) for f in found] == [("i", "I", "capitalization", 0, 1), ("m", "'m", "punctuation", 1, 3), ("ana", "Ana.", "capitalization", 4, 7)]
    assert found[2].explanation_es.startswith("Los nombres propios se escriben con mayúscula inicial.")


def test_i_m_teacher_como_grammarmama():
    """[2026-11-02]: caso real — el LLM solo devolvió «i m → I'm»; faltaban «I», «'m» y «a teacher.» por separado."""
    raw = json.dumps({"findings": [{"type": "capitalization", "original": "i m", "correction": "I'm", "explanation_es": "x"}], "corrected_text": "I'm teacher"})
    draft = parse_draft(raw, "i m teacher", "en")
    assert draft.corrected_text == "I'm a teacher."
    assert [(f.original, f.correction, f.type.value) for f in draft.findings] == [("i", "I", "capitalization"), ("m", "'m", "punctuation"), ("teacher", "a teacher.", "article")]
    assert "punto" in draft.findings[2].explanation_es


def test_diff_i_m_ana_sin_ayuda_del_llm():
    assert [(f.original, f.correction, f.type.value) for f in diff_findings("i m ana", "I'm Ana")] == [("i m", "I'm", "spelling"), ("ana", "Ana", "capitalization")]


def test_explicacion_de_mayusculas_mezclada_se_reemplaza():
    raw = json.dumps({"findings": [{"type": "capitalization", "original": "je", "correction": "Je", "explanation_es": "Les pronoms propres siempre se escriben con mayúscula inicial."}], "corrected_text": "Je suis Ana"})
    found = parse_draft(raw, "je suis ana", "fr").findings
    # [2026-11-13 · Anexo A regla 6]: el signo final ya se exige en los 7 idiomas → se suma al hallazgo de la última palabra
    assert [f.explanation_es for f in found] == ["La primera palabra de la oración se escribe con mayúscula inicial.", "Los nombres propios se escriben con mayúscula inicial. Además, la oración debe terminar con un punto."]


def test_texto_corregido_parcial_se_reconstruye_entero() -> None:
    """[2026-10-30]: el modelo devuelve solo lo que corrigió → se aplica sobre el texto completo."""
    from src.modules.own_llm.domain.writing_finding import WritingFinding
    from src.modules.own_llm.infrastructure.models.writing_corrector_model import complete_corrected

    text = "i go to the school every day with my friends"
    finding = WritingFinding(type="capitalization", original="i", correction="I", explanation_es="Mayúscula.", start=0, end=1)
    assert complete_corrected(text, "I", [finding]) == "I go to the school every day with my friends"
    assert complete_corrected(text, "I go to school every day with my friends.", [finding]).startswith("I go to school")


def test_merge_el_diff_gana_si_contiene_al_hallazgo_del_llm():
    """[2026-10-31]: caso real «i m lina» → el LLM lista «i → I» y sin esto se pierde el apóstrofo de «I'm»."""
    text = "i m lina"
    llm = ErrorFinding(type="capitalization", original="i", correction="I", explanation_es="x", start=0, end=1)
    merged = merge_findings([llm], diff_findings(text, "I'm Lina"))
    assert [(f.original, f.correction) for f in merged] == [("i m", "I'm"), ("lina", "Lina")]
    assert "apóstrofo" in merged[0].explanation_es


def test_idiomas_no_ingles_explicaciones_por_error_sin_mencionar_ingles():
    """[2026-11-03]: casos reales — el LLM juntaba errores o copiaba el ejemplo inglés («contracción de 'I am'») en francés/alemán/portugués."""
    fr = json.dumps({"findings": [{"type": "capitalization", "original": "je sui", "correction": "Je suis", "explanation_es": "En español, el pronombre 'yo' siempre se escribe con mayúscula y la contracción de 'I am' es 'Yo soy'."}], "corrected_text": "Je suis Ana"})
    de = json.dumps({"findings": [{"type": "capitalization", "original": "ich bi ana", "correction": "Ich bin Ana", "explanation_es": "Großschreibung."}], "corrected_text": "Ich bin Ana"})
    pt = json.dumps({"findings": [{"type": "capitalization", "original": "Eu so", "correction": "Eu só", "explanation_es": "Maiúsculas."}], "corrected_text": "Eu só Ana"})
    for raw, text, lang in [(fr, "je sui ana", "fr"), (de, "ich bi ana", "de"), (pt, "Eu so  ana", "pt")]:
        draft = parse_draft(raw, text, lang)
        assert all("ingl" not in f.explanation_es and "I am" not in f.explanation_es for f in draft.findings), draft.findings
        assert all(text[f.start : f.end] == f.original for f in draft.findings)
    assert [(f.original, f.correction, f.type.value) for f in parse_draft(de, "ich bi ana", "de").findings] == [
        ("ich", "Ich", "capitalization"), ("bi", "bin", "grammar"), ("ana", "Ana.", "capitalization")]  # [2026-11-13]: + punto final (7 idiomas)
    assert [(f.original, f.type.value) for f in parse_draft(fr, "je sui ana", "fr").findings] == [("je", "capitalization"), ("sui", "grammar"), ("ana", "capitalization")]
    [so, _] = parse_draft(pt, "Eu so  ana", "pt").findings
    assert (so.original, so.type.value) == ("so", "spelling") and "tilde" in so.explanation_es


def test_llm_garbage_is_dropped_keeping_rules():
    # [2026-11-10]: «my name is Paula I am…» → el LLM devolvía «My Name Am Paula Am…» y metía español («deliciosa»)
    import json

    from src.modules.own_llm.infrastructure.models.writing_corrector_model import parse_draft

    bad = {"findings": [{"type": "grammar", "original": "is", "correction": "Am", "explanation_es": "x"}],
           "corrected_text": "My Name Am Paula Am from Colombia.", "explanation_es": "x"}
    # [2026-11-13 · Caso A]: dos oraciones pegadas → punto entre ellas («Paula. I am»)
    assert parse_draft(json.dumps(bad), "my name is Paula I am from Colombia").corrected_text == "My name is Paula. I am from Colombia."
    es = {"findings": [{"type": "spelling", "original": "delicio", "correction": "deliciosa", "explanation_es": "x"}],
          "corrected_text": "Food deliciosa.", "explanation_es": "x"}
    assert "deliciosa" not in parse_draft(json.dumps(es), "Food delicio").corrected_text
    ok = {"findings": [{"type": "grammar", "original": "likes", "correction": "like", "explanation_es": "x"}],
          "corrected_text": "I like pasta.", "explanation_es": "x"}
    assert parse_draft(json.dumps(ok), "i likes pasta").corrected_text == "I like pasta."
