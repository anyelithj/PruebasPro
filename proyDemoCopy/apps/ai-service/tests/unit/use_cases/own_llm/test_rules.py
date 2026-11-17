"""Pruebas de las reglas deterministas del corrector (paso 2 · deterministic-first · 7 idiomas).

Cada regla es una función pura → se prueba sin LLM ni red. Incluye el Caso A completo con Ollama caído (solo reglas).
[Patrón]: Table-Driven Tests (`pytest.mark.parametrize`) | [Principio]: una aserción por comportamiento.
"""

import pytest

from src.modules.own_llm.domain.rules import RuleContext, apply_findings, finalize, rule_findings
from src.modules.own_llm.domain.rules.english import article_for
from src.modules.own_llm.infrastructure.models.writing_corrector_model import rules_only_draft

ASK_NAME = "Hi! I'm Aula. What's your name, and where are you from?"


def fix(text: str, language: str, question: str = "", spoken: bool = False) -> str:
    """Texto corregido SOLO con reglas (lo que verá el estudiante si Ollama está caído)."""
    ctx = RuleContext(language, question=question, spoken=spoken)
    return apply_findings(text, finalize(text, rule_findings(text, ctx), ctx))


def test_caso_a_exacto_con_solo_reglas() -> None:
    """Caso A: pregunta previa + voz → «My name is Laura. I'm from Colombia.»"""
    text = "my niece is Laura I'm on from Columbia"
    draft = rules_only_draft(text, RuleContext("en", question=ASK_NAME, spoken=True))
    assert draft is not None and draft.corrected_text == "My name is Laura. I'm from Colombia."
    kinds = {f.original.strip() or f.original: f.type.value for f in draft.findings}
    assert kinds["niece"] == "transcription"  # Error del dictado, no del estudiante (Anexo A regla 2)
    assert kinds["my"] == "capitalization" and kinds["on from"] == "grammar" and kinds["Columbia"] == "spelling"
    assert any(f.correction == ". " for f in draft.findings)  # Punto entre las dos oraciones


def test_caso_a_escrito_no_es_transcripcion_y_sin_pregunta_no_se_toca_niece() -> None:
    ctx = RuleContext("en", question=ASK_NAME, spoken=False)
    [f] = [f for f in rule_findings("my niece is Laura", ctx) if f.original == "niece"]
    assert f.type.value == "vocabulary"  # Escrito → vocabulario, no dictado
    assert fix("my niece is Laura", "en") == "My niece is Laura."  # Sin pregunta por el nombre «niece» puede ser correcto


@pytest.mark.parametrize(
    ("word", "article"),
    [("hour", "an"), ("university", "a"), ("apple", "an"), ("dog", "a"), ("European", "a"), ("honest", "an"), ("umbrella", "an")],
)
def test_a_an_por_sonido(word: str, article: str) -> None:
    assert article_for(word) == article


def test_a_an_corrige_y_respeta_siglas() -> None:
    assert fix("I study at an university and wait a hour", "en") == "I study at a university and wait an hour."
    assert fix("She has an MBA", "en") == "She has an MBA."  # Sigla: se lee «em-bi-ei» → no se toca


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("I'm on from Mexico", "I'm from Mexico."),
        ("she is in from spain", "She is from Spain."),  # Preposición sobrante + país con mayúscula
        ("i m on from Peru", "I'm from Peru."),  # Dictado sin apóstrofo
        ("I live on Main Street", "I live on Main Street."),  # «on» legítimo: no se toca
    ],
)
def test_on_from(text: str, expected: str) -> None:
    assert fix(text, "en") == expected


def test_oraciones_pegadas_solo_sin_conjuncion() -> None:
    assert fix("My name is Ana I am from Chile", "en") == "My name is Ana. I am from Chile."
    assert fix("My name is Ana and I am from Chile", "en") == "My name is Ana and I am from Chile."
    assert fix("I think I'm ready", "en") == "I think I'm ready."


@pytest.mark.parametrize(
    ("text", "language", "expected"),
    [
        ("I'm from Columbia", "en", "I'm from Colombia."),
        ("I study at Columbia University", "en", "I study at Columbia University."),  # Universidad real
        ("She lives in British Columbia", "en", "She lives in British Columbia."),  # Provincia real de Canadá
        ("Soy de Columbia", "es", "Soy de Colombia."),
        ("Je viens de Columbia", "fr", "Je viens de Colombie."),
        ("Ich komme aus Columbia", "de", "Ich komme aus Kolumbien."),
        ("Eu sou da Columbia", "pt", "Eu sou da Colômbia."),
        ("vivo en mexico", "es", "Vivo en México."),  # Mayúscula + tilde
        ("я из колумбия", "ru", "Я из Колумбия."),  # Mayúscula inicial y del país (la declinación la cubre el LLM)
    ],
)
def test_paises_en_los_7_idiomas(text: str, language: str, expected: str) -> None:
    assert fix(text, language) == expected


@pytest.mark.parametrize(
    ("text", "language", "expected"),
    [
        ("I am colombian and I speak spanish", "en", "I am Colombian and I speak Spanish."),
        ("Soy Colombiano y hablo Español", "es", "Soy colombiano y hablo español."),
        ("Eu sou Brasileiro", "pt", "Eu sou brasileiro."),
        ("Je suis Colombien", "fr", "Je suis colombien."),  # Adjetivo tras «être» → minúscula
        ("Un Colombien parle", "fr", "Un Colombien parle."),  # Sustantivo → mayúscula correcta
        ("Vivo en China", "es", "Vivo en China."),  # País «China» ≠ gentilicio «china»
    ],
)
def test_gentilicios_segun_el_idioma(text: str, language: str, expected: str) -> None:
    assert fix(text, language) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Cómo estás?", "¿Cómo estás?"),
        ("como te llamas?", "¿Como te llamas?"),  # Cierre «?» presente → apertura + mayúscula en un solo hallazgo
        ("Qué bien!", "¡Qué bien!"),
        ("Dónde vives", "¿Dónde vives?"),  # Sin signos: el interrogativo con tilde la delata
        ("¿Cómo estás?", "¿Cómo estás?"),  # Ya correcta: sin cambios
        ("Hola. cómo estás?", "Hola. ¿Cómo estás?"),  # Segunda oración
    ],
)
def test_signos_de_apertura_en_espanol(text: str, expected: str) -> None:
    assert fix(text, "es") == expected


@pytest.mark.parametrize(
    ("text", "language", "expected"),
    [
        ("where are you from", "en", "Where are you from?"),
        ("je suis ana", "fr", "Je suis ana."),  # Los nombres propios los marca el LLM, no las reglas
        ("wie heißt du", "de", "Wie heißt du?"),
        ("onde você mora", "pt", "Onde você mora?"),
        ("как тебя зовут", "ru", "Как тебя зовут?"),
        ("我是学生", "zh", "我是学生。"),  # Chino: sin mayúsculas y signo de ancho completo
        ("你叫什么名字", "zh", "你叫什么名字？"),
        ("Yes", "en", "Yes"),  # Una sola palabra: no se exige punto
    ],
)
def test_mayuscula_y_signo_final_en_los_7_idiomas(text: str, language: str, expected: str) -> None:
    assert fix(text, language) == expected


def test_sin_errores_no_hay_hallazgos_y_la_corrida_es_determinista() -> None:
    assert rules_only_draft("My name is Laura. I'm from Colombia.", RuleContext("en", question=ASK_NAME, spoken=True)) is None
    text = "my niece is Laura I'm on from Columbia"
    assert fix(text, "en", ASK_NAME, True) == fix(text, "en", ASK_NAME, True)  # Misma entrada → misma salida
