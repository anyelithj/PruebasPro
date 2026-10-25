"""Tests Sprint 9.6: persona «dialogue» — apertura determinista, LLM dentro del tema, corrección suave y LLM caído.

[Patrón]: Test Double (FakeLlm) + AAA.
"""

import json

from src.modules.assistant.application.schemas.chat_request import ChatRequest
from src.modules.assistant.application.use_cases.chat_with_agent import ChatWithAgentUseCase
from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.value_objects.screen_context import ScreenContext
from src.modules.assistant.domain.value_objects.topic_script import OPENINGS, DialogueContext
from src.modules.assistant.infrastructure.agents.agent_factory import AgentFactory
from src.modules.assistant.infrastructure.agents.dialogue_agent import START, DialogueAgent
from src.modules.assistant.infrastructure.repositories.conversation_repository import InMemoryConversationRepository

FOOD = DialogueContext(topic="food", title="Food", objectives=["Say your favourite dish"], vocabulary=["pasta", "spicy"])


class FakeLlm:
    def __init__(self, data: dict | None) -> None:
        self.data, self.calls, self.prompt = data, 0, ""

    async def generate(self, prompt: str, **_: object) -> str:
        self.calls, self.prompt = self.calls + 1, prompt
        if self.data is None:
            raise RuntimeError("Ollama caído")
        return json.dumps(self.data)


async def say(llm: FakeLlm, text: str, lang: str = "en", ctx: DialogueContext = FOOD):
    return await DialogueAgent(llm).reply(Conversation(id="c", user_id="u"), text, lang, ScreenContext(route=None, role="USER", level="A2", dialogue=ctx))


def test_los_ocho_temas_tienen_apertura_en_los_siete_idiomas():
    assert len(OPENINGS) == 8 and all(set(v) == {"en", "es", "fr", "de", "pt", "zh", "ru"} for v in OPENINGS.values())


async def test_apertura_sin_llm_en_el_idioma_y_la_del_docente_prevalece():
    llm = FakeLlm({"reply": "x"})
    assert (await say(llm, START, "ru")).text == OPENINGS["food"]["ru"] and llm.calls == 0
    own = FOOD.model_copy(update={"topic": "space", "opening": "Do you like stars?"})
    assert (await say(llm, START, "en", own)).text == "Do you like stars?"


async def test_turno_libre_con_correccion_suave_y_vocabulario_usado():
    llm = FakeLlm({"reply": "Oh, you like spicy pasta! Why?", "correction": "Se dice «I like», no «I likes»."})
    r = await say(llm, "I likes spicy pasta")
    assert r.answered_by == "llm" and r.game_state == {"vocabulary_used": ["pasta", "spicy"], "correction": "Se dice «I like», no «I likes».", "translation": None, "learner_translation": None}
    assert "Learner level: A2" in llm.prompt and "Topic: Food" in llm.prompt


async def test_llm_caido_pregunta_abierta_en_el_idioma():
    r = await say(FakeLlm(None), "Me gusta la paella", "es")
    assert r.text.startswith("¡Qué interesante!") and r.answered_by == "engine"


async def test_el_estado_va_al_campo_dialogue_de_la_respuesta():
    uc = ChatWithAgentUseCase(InMemoryConversationRepository(), AgentFactory({"dialogue": DialogueAgent(FakeLlm({"reply": "Nice!"}))}))
    res = await uc.execute(ChatRequest(message="pasta", persona="dialogue", language="en", dialogue=FOOD), "u1")
    assert res.dialogue == {"vocabulary_used": ["pasta"], "correction": None, "translation": None, "learner_translation": None} and res.game is None


async def test_si_el_avatar_responde_en_espanol_en_un_dialogo_en_ingles_reintenta_y_si_insiste_usa_la_pregunta_fija() -> None:
    # [Bug 2026-10-19]: en un diálogo en inglés el avatar contestó «¿Por qué te gusta el sabor de la comida mexicana?…»
    llm = FakeLlm({"reply": "¿Por qué te gusta el sabor de la comida mexicana? Creo que es porque tiene sabores picantes.", "correction": None})
    r = await say(llm, "I like Mexican food")
    assert llm.calls == 2 and "never in Spanish" in llm.prompt  # Un reintento con la orden explícita
    assert "¿" not in r.text and r.answered_by == "engine"  # Insistió en español → pregunta abierta del idioma


def test_drifted_to_spanish_distingue_espanol_de_otros_idiomas() -> None:
    from src.shared.domain.text_norm import drifted_to_spanish

    assert drifted_to_spanish("Creo que es porque tiene sabores picantes y verduras.", "en")
    assert not drifted_to_spanish("What's your favourite food? Do you like cooking?", "en")
    assert not drifted_to_spanish("Je pense que la cuisine mexicaine est délicieuse.", "fr")
    assert not drifted_to_spanish("¿Qué tal?", "es")


async def test_respaldo_no_repite_la_misma_pregunta_y_trae_la_traduccion() -> None:
    # [Bug 2026-10-20]: con el LLM caído el avatar repetía siempre «Interesting! Can you tell me a bit more?»
    from src.modules.assistant.domain.value_objects.message import Message

    conv = Conversation(id="c", user_id="u")
    ctx = ScreenContext(route=None, role="USER", level="A2", dialogue=FOOD)
    agent = DialogueAgent(FakeLlm(None))
    said: list[str] = []
    for text in ("I like pizza", "Cheese pizza", "With my family"):
        conv.append(Message.user(text))
        r = await agent.reply(conv, text, "en", ctx)
        conv.append(Message.assistant(r.text))
        said.append(r.text)
    assert len(set(said)) == 3  # Tres respaldos distintos
    llm = FakeLlm({"reply": "Do you cook at home?", "translation": "¿Cocinas en casa?", "correction": None})
    ok = await DialogueAgent(llm).reply(conv, "Yes", "en", ctx)
    assert ok.game_state["translation"] == "¿Cocinas en casa?"


def test_casi_repeticion_y_traduccion_de_la_apertura() -> None:
    # [Bug 2026-10-23]: «Great! What ingredients…» repetía la pregunta anterior cambiando solo la exclamación; la apertura salía sin traducción («—»)
    from src.modules.assistant.domain.value_objects.topic_script import opening_es
    from src.modules.assistant.infrastructure.agents.dialogue_agent import _repeats
    from src.shared.domain.text_norm import norm

    asked = {norm("That sounds yummy! What ingredients do you use for your cheese pizza?")}
    assert _repeats("Great! What ingredients do you use for your cheese pizza?", asked)
    assert not _repeats("Do you cook with your family on weekends?", asked)
    assert opening_es(FOOD, "en")  # Tema semilla «food» → «¿Cuál es tu comida favorita?…»


def test_tutor_detecta_respuesta_evasiva() -> None:
    # [Bug 2026-10-23]: ante «los artículos a, an, the» el tutor volvía a saludar y a preguntar qué practicar
    from src.modules.assistant.infrastructure.agents.tutor_agent import _dodges

    assert _dodges("¡Hola! Encantado de verte. ¿Quieres practicar hoy alguna parte específica del inglés?")
    assert not _dodges('Los artículos "a" y "an" son indefinidos: "a dog", "an apple".')


async def test_despedida_cierra_la_conversacion_sin_llm():
    # [2026-10-23]: «…; goodbye.» → cierre fijo con su traducción y `finished` (NestJS termina la sesión)
    llm = FakeLlm({"reply": "What else?"})
    out = await say(llm, "The cheese is mild, fresh, and sweet; goodbye.")
    assert out.game_state["finished"] is True and out.game_state["translation"] and llm.calls == 0
    assert "finished" not in (await say(llm, "How do you say goodbye in French when you leave?")).game_state
