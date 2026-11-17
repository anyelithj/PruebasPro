from src.shared.domain.llm_output import natural_age, parse_translation


def test_age_uses_tener() -> None:
    assert natural_age("Soy de diez años.") == "Tengo diez años."
    assert natural_age("yo estoy 10 años") == "tengo 10 años"
    assert natural_age("Mi hermano es de diez años") == "Mi hermano es de diez años"
    assert parse_translation('"Soy de diez años."') == "Tengo diez años."


def test_rules_flag_repeated_word_and_skip_numbers() -> None:
    from src.modules.own_llm.domain.rules import apply_findings, plausible
    from src.modules.own_llm.domain.rules.english import english_findings
    from src.modules.own_llm.domain.writing_finding import WritingErrorType as T
    from src.modules.own_llm.domain.writing_finding import WritingFinding as F

    text = "My name is Laura I I am from Colombia"
    assert apply_findings(text, english_findings(text)) == "My name is Laura I am from Colombia"
    assert not plausible("I am 10 years old", F(type=T.SPELLING, original="10", correction="ten", start=5, end=7, explanation_es="x"))
    assert not plausible("my whole life ever say", F(type=T.GRAMMAR, original="my whole life ever say", correction=",", start=0, end=22, explanation_es="x"))


def test_mid_sentence_capital_on_common_word_is_rejected() -> None:
    from src.modules.own_llm.domain.rules import plausible
    from src.modules.own_llm.domain.writing_finding import WritingErrorType as T
    from src.modules.own_llm.domain.writing_finding import WritingFinding as F

    text = "my name is Laura and I am from colombia"
    assert not plausible(text, F(type=T.CAPITALIZATION, original="name", correction="Name", start=3, end=7, explanation_es="x"))
    assert plausible(text, F(type=T.CAPITALIZATION, original="colombia", correction="Colombia", start=31, end=39, explanation_es="x"))


def test_question_gets_question_mark() -> None:
    from src.modules.own_llm.domain.rules import RuleContext, apply_findings, finalize

    en = RuleContext("en")

    assert apply_findings("where are you from", finalize("where are you from", [], en)) == "where are you from?"
    assert apply_findings("I live here", finalize("I live here", [], en)) == "I live here."
