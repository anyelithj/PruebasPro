from src.modules.assistant.infrastructure.agents.dialogue_agent import says_goodbye


def test_farewell_at_start_or_end_closes():
    assert says_goodbye("Goodbye, it was nice talking to you", "en")
    assert says_goodbye("Thanks for the chat. See you tomorrow!", "en")
    assert says_goodbye("Ok, adiós", "en")


def test_word_goodbye_in_question_does_not_close():
    assert not says_goodbye("How do you say goodbye in French when you meet friends?", "en")
