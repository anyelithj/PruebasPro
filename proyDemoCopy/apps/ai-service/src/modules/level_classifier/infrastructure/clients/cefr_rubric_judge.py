"""CefrRubricJudge — el LLM local aplica una rúbrica CEFR a un caso dudoso (Sprint 9.5).

[Patrón]: Adapter (LLMClient → juicio estructurado) + Null Object (None si el LLM no responde).
[Principio]: determinístico primero — solo se llama cuando los indicadores no bastan; DRY (generate_json compartido).
[Paradigma]: Asíncrono.
"""

from src.modules.feedback.domain.interfaces.llm_client import LLMClient
from src.modules.level_classifier.domain.value_objects.estimated_level import LEVELS, CefrLevel
from src.shared.clients.llm_json import generate_json

# [Rúbrica]: descriptores resumidos del MCER (comprensión de textos y conversación); también los expone GET /criteria
RUBRIC: dict[CefrLevel, str] = {
    "A1": "Very short, isolated phrases about oneself and immediate needs; basic greetings; present tense only.",
    "A2": "Short simple sentences on familiar routines, family, shopping; simple connectors (and, but, because).",
    "B1": "Connected text on familiar topics; describes experiences, plans and opinions with simple reasons.",
    "B2": "Clear detailed text on a wide range of topics; argues a viewpoint; varied connectors and tenses.",
    "C1": "Well-structured complex text; flexible, idiomatic; implicit meaning; precise vocabulary.",
    "C2": "Near-native subtlety; nuanced, highly idiomatic, rhetorical control across registers.",
}
_SYSTEM = (
    "You are a CEFR examiner. Classify the difficulty of a text a learner would read or hear. "
    'Return ONLY JSON: {"level": "A1|A2|B1|B2|C1|C2", "reason": "<one short sentence in Spanish>"}.'
)


class CefrRubricJudge:
    def __init__(self, llm: LLMClient, model: str) -> None:
        self._llm = llm
        self.model = model

    async def judge(self, text: str, language: str, hint: CefrLevel) -> tuple[CefrLevel, str] | None:
        rubric = "\n".join(f"{k}: {v}" for k, v in RUBRIC.items())
        prompt = f"Rubric:\n{rubric}\n\nMeasured indicators suggest {hint}. Language: {language}.\nText:\n{text[:3000]}"
        data = await generate_json(self._llm, prompt, system=_SYSTEM, max_tokens=120, temperature=0.0)
        level = str((data or {}).get("level", "")).upper()
        if level not in LEVELS:  # LLM caído o respuesta fuera de la escala → el llamador se queda con los indicadores
            return None
        return level, str((data or {}).get("reason", "")).strip()  # type: ignore[return-value]
