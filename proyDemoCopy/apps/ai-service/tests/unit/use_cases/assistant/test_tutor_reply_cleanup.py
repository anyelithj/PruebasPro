"""[2026-10-30]: el tutor no copia su contexto al responder y las dudas no se tratan como práctica."""
from src.modules.assistant.infrastructure.agents.tutor_agent import _clean_reply, _is_doubt


def test_quita_el_guion_y_la_regla_copiados() -> None:
    raw = "En el nivel A2 tu meta es que al menos el 40 % de tus palabras estén en inglés.\n\nEstudiante: I can dance"
    assert _clean_reply(raw) == ""


def test_conserva_la_respuesta_real() -> None:
    assert _clean_reply("Tutor: ✓ Muy bien. Ahora: can you swim?\nEstudiante: yes") == "✓ Muy bien. Ahora: can you swim?"


def test_detecta_dudas() -> None:
    assert _is_doubt("no entendí el verbo can")
    assert _is_doubt("¿cuándo se usa can?")
    assert not _is_doubt("I can dance")


def test_mejor_asi_igual_a_lo_dicho_se_quita_y_despedida() -> None:
    # [2026-11-09]: «(Mejor así: "<la misma frase>")» confundía; despedirse corta el reto
    from src.modules.assistant.infrastructure.agents.tutor_agent import _drop_same_fix, _is_farewell

    said = "I like to have bread and jam for breakfast."
    assert _drop_same_fix(f'Great! (Mejor así: "{said}")', said) == "Great!"
    assert "I have" in _drop_same_fix("Mejor así: I have three cats", "I had three cats")
    assert _is_farewell("adiós, gracias") and not _is_farewell("I like dogs")
