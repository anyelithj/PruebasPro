"""Tests Sprint 8.7: motores deterministas de los seis juegos + GameAgent (LLM falso y LLM caído).

[Patrón]: Test Double (FakeLlm) + AAA.
[Principio]: determinístico primero — faltas, aciertos y objetivos se deciden sin LLM.
"""

import json

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.game_engine import says
from src.modules.assistant.domain.value_objects.game_context import GameContext, Objective
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.infrastructure.agents.game_agent import GameAgent
from src.modules.assistant.infrastructure.games.describe_guess_engine import letter_hint
from src.modules.assistant.infrastructure.games.role_play_engine import objectives_met


class FakeLlm:
    def __init__(self, reply: str | None) -> None:
        self.reply, self.calls = reply, 0

    async def generate(self, prompt: str, **_: object) -> str:
        self.calls += 1
        if self.reply is None:
            raise RuntimeError("Ollama caído")
        return json.dumps({"reply": self.reply})


async def play(llm: FakeLlm, ctx: GameContext, text: str):
    ctx_screen = ScreenContext(route=None, role="USER", game=ctx)
    return await GameAgent(llm).reply(Conversation(id="c", user_id="u"), text, "en", ctx_screen)


def test_says_sin_falsos_positivos_y_sin_tildes():
    assert says("I love my CAT", "cat") and not says("category", "cat")
    assert says("Un café, por favor", "cafe") and says("on the other hand, no", "on the other hand")


async def test_tabu_falta_sin_llm_y_acierto_decidido_por_el_motor():
    ctx = GameContext(game="taboo", target="apple", forbidden=["fruit", "red"])
    llm = FakeLlm("Is it an apple?")
    foul = await play(llm, ctx, "It is a red fruit")
    assert foul.answered_by == "engine" and foul.game_state["violation"] and llm.calls == 0
    guess = await play(llm, ctx, "You eat it and it grows on trees")
    assert guess.game_state["solved"] is True and llm.calls == 1


async def test_veinte_preguntas_acierto_y_formato():
    ctx = GameContext(game="twenty_questions", target="dog", turn=3)
    llm = FakeLlm("Yes")
    assert (await play(llm, ctx, "Is it a dog")).game_state["solved"]
    assert "pregunta" in (await play(llm, ctx, "tell me")).text
    answer = await play(llm, ctx, "Is it an animal?")
    assert answer.text == "Yes" and answer.game_state["questions_left"] == 17


async def test_describe_adivina_pista_de_letras_si_el_llm_cae():
    assert letter_hint("apple", 2) == "a p _ _ _ (5 letras)"
    res = await play(FakeLlm(None), GameContext(game="describe_guess", target="apple", turn=3), "banana")
    assert res.text.startswith("Pista: a p _")


async def test_historia_exige_palabra_del_turno_y_debate_conectores():
    story = GameContext(game="chained_story", vocabulary=["castle", "dragon"], turn=1)
    assert "castle" in (await play(FakeLlm("x"), story, "Once upon a time there lived a king")).text
    ok = await play(FakeLlm("A dragon appeared."), story, "The king lived in a huge castle")
    assert ok.game_state == {"accepted": True, "next_word": "dragon"}
    debate = GameContext(game="debate", topic="homework", max_turns=5)
    res = await play(FakeLlm("But why?"), debate, "Homework is useful because it builds habits; however it is long")
    assert set(res.game_state["connectors"]) == {"because", "however"}


async def test_role_play_marca_objetivos_por_palabras_clave():
    ctx = GameContext(
        game="role_play",
        role="a waiter",
        objectives=[Objective(id="order", text="Pide un plato", keywords=["I'd like", "order"]), Objective(id="bill", text="Pide la cuenta", keywords=["bill", "check"])],
        met=["order"],
    )
    assert objectives_met(ctx, "Can I have the bill, please?") == ["bill", "order"]
    res = await play(FakeLlm("Here you are."), ctx, "Can I have the bill, please?")
    assert res.game_state["finished"] is True and res.game_state["pending"] == []
