"""Caso de uso: traducir un término o una frase con el LLM local.

[Patrón]: Use Case (Command) + Port (LlmPort).
[Principio]: SRP + DIP + determinístico primero (origen = destino → sin LLM; NestJS consulta su caché antes de llamar aquí).
[Paradigma]: POO + asíncrono.
"""

from types import MappingProxyType

from src.modules.language_tools.application.schemas.translate_request import TranslateRequest, TranslateResponse
from src.modules.language_tools.domain.interfaces.llm_client import LlmPort
from src.shared.clients.llm_json import generate_json

# [Nombre del idioma en español]: lo entiende mejor el LLM que el código ISO | `MappingProxyType`: solo lectura
LANGUAGE_NAMES = MappingProxyType(
    {"en": "inglés", "fr": "francés", "de": "alemán", "es": "español", "pt": "portugués", "zh": "chino mandarín", "ru": "ruso"}
)
_SYSTEM = (
    "Eres un traductor profesional. Devuelve SOLO JSON con las claves: "
    '"translation" (string), "alternatives" (lista de hasta 3 strings cortos) y '
    '"register" ("formal", "informal" o "neutral"). No expliques nada.'
)
UNAVAILABLE = "unavailable"  # Modelo cuando el LLM no respondió (la UI muestra el IPA y avisa)


class TranslateTextUseCase:
    def __init__(self, llm: LlmPort, model: str) -> None:
        self._llm = llm  # [DI por constructor]: el router inyecta el OllamaClient compartido
        self._model = model

    async def execute(self, req: TranslateRequest) -> TranslateResponse:
        if req.source == req.target:  # [Determinístico]: nada que traducir
            return TranslateResponse(translation=req.text, model="")
        prompt = f"Traduce del {LANGUAGE_NAMES[req.source]} al {LANGUAGE_NAMES[req.target]}:\n{req.text.strip()}"
        data = await generate_json(self._llm, prompt, system=_SYSTEM)
        if not data or not str(data.get("translation", "")).strip():
            return TranslateResponse(translation="", model=UNAVAILABLE)
        register = data.get("register")
        return TranslateResponse(
            translation=str(data["translation"]).strip(),
            alternatives=[str(a).strip() for a in data.get("alternatives", []) if str(a).strip()][:3],
            tone=register if register in ("formal", "informal", "neutral") else "neutral",
            model=self._model,
        )
