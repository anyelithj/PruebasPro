"""Caso de uso: traducir un término o una frase con el LLM local.

[Patrón]: Use Case (Command) + Port (LlmPort) + Chain of Responsibility (diccionario → caché → LLM → reintento → «no disponible»)
+ Specification (`is_acceptable`).
[Principio]: SRP + DIP + determinístico primero (origen = destino, respuestas cortas y glosario → sin LLM) + Fail Safe
(una salida dudosa se reintenta UNA vez; si sigue mal, «no disponible» en vez de basura en la UI).
[Paradigma]: POO + asíncrono.
[Bug 2026-10-25]: JSON crudo como traducción, «yes» → «yes», «Bell pepper» → «Pepino verde», voseo y «el carne» (ver translation_rules).
"""

from types import MappingProxyType

from src.modules.language_tools.application.schemas.translate_request import TranslateRequest, TranslateResponse
from src.modules.language_tools.domain.interfaces.llm_client import LlmPort
from src.modules.language_tools.domain.interfaces.translation_cache import TranslationCachePort
from src.modules.language_tools.domain.translation_rules import glossary_hints, is_acceptable, normalize_spanish, quick_translation
from src.shared.clients.llm_json import generate_json
from src.shared.domain.llm_output import parse_translation

# [Nombre del idioma en español]: lo entiende mejor el LLM que el código ISO | `MappingProxyType`: solo lectura
LANGUAGE_NAMES = MappingProxyType(
    {"en": "inglés", "fr": "francés", "de": "alemán", "es": "español", "pt": "portugués", "zh": "chino mandarín", "ru": "ruso"}
)
# [Reglas comunes · DRY]: las usan la traducción suelta y la de líneas por lotes (EnrichLines)
TRANSLATION_RULES = (
    "Traduces para estudiantes hispanohablantes. Reglas: español neutro de Latinoamérica con «tú» (nunca «vos» ni voseo: "
    "«prefieres», no «preferís»); traduce TODO, también respuestas cortas («yes» → «sí», «OK» → «de acuerdo»); "
    "concordancia correcta de género y número («la carne molida»); mantén los nombres propios; usa el nombre habitual en "
    "español de comidas y objetos («bell pepper» → «pimiento morrón», «olives» → «aceitunas», «onions» → «cebollas», "
    "«rooster's beak» → «pico de gallo», «jalapeños» → «jalapeños»); no expliques, no añadas comillas ni texto extra."
)
_SYSTEM = (
    f"Eres un traductor profesional. {TRANSLATION_RULES}\n"
    'Devuelve SOLO JSON: {"translation": "...", "alternatives": ["hasta 3 alternativas cortas"], "register": "formal|informal|neutral"}.\n'
    "Ejemplos:\n"
    '«Do you prefer tacos or burritos?» → {"translation": "¿Prefieres tacos o burritos?", "alternatives": [], "register": "informal"}\n'
    '«I like ground meat spicy, with vegetables.» → {"translation": "Me gusta la carne molida picante, con verduras.", "alternatives": [], "register": "neutral"}\n'
    '«Bell pepper, jalapeños, olives and onions.» → {"translation": "Pimiento morrón, jalapeños, aceitunas y cebollas.", "alternatives": [], "register": "neutral"}'
)
# [Reintento]: orden más estricta cuando la primera salida no pasó el control de calidad
STRICT_NOTE = "IMPORTANTE: tu respuesta anterior no era una traducción válida al español. Escribe SOLO la traducción al español, completa."
UNAVAILABLE = "unavailable"  # Modelo cuando el LLM no respondió (la UI muestra el IPA y avisa)
DETERMINISTIC = "dictionary"  # Modelo cuando tradujo el diccionario/glosario (sin LLM)
_TEMPERATURE = 0.1  # Baja: la traducción no debe «inventar» (antes 0.2 por defecto)


def system_with_glossary(base: str, texts: list[str], source: str) -> str:
    """Añade al prompt de sistema los equivalentes del glosario presentes en los textos. [Principio]: DRY (lote y frase suelta)."""
    hints = {k: v for t in texts for k, v in glossary_hints(t, source)}  # Comprensión de dict: sin duplicados entre líneas
    return base if not hints else base + "\nUsa estos equivalentes: " + "; ".join(f"«{k}» → «{v}»" for k, v in hints.items()) + "."


class TranslateTextUseCase:
    def __init__(self, llm: LlmPort, model: str, cache: TranslationCachePort | None = None) -> None:
        self._llm = llm  # [DI por constructor]: el router inyecta el OllamaClient compartido
        self._model = model
        self._cache = cache  # [DI]: caché compartida del proceso (None en tests → resultados independientes)

    @property
    def llm(self) -> LlmPort:
        """LLM compartido con EnrichLines (traducción por lotes con el mismo cliente). `@property`: acceso de solo lectura."""
        return self._llm

    def known(self, text: str, source: str, target: str = "es") -> str | None:
        """Traducción SIN LLM: diccionario/glosario o caché. [Patrón]: Chain of Responsibility (primeros eslabones)."""
        return quick_translation(text, source, target) or (self._cache.get(text, source, target) if self._cache else None)

    def accept(self, text: str, raw: object, source: str, target: str = "es") -> str | None:
        """Limpia la salida del LLM (JSON, comillas, voseo) y la valida; si pasa, la cachea. None = no usable."""
        cleaned = parse_translation(raw, text)
        fixed = normalize_spanish(cleaned) if cleaned and target == "es" else cleaned
        if not is_acceptable(text, fixed, source, target):
            return None
        if self._cache and fixed:
            self._cache.put(text, source, fixed, target)
        return fixed

    async def execute(self, req: TranslateRequest) -> TranslateResponse:
        text = req.text.strip()
        if req.source == req.target:  # [Determinístico]: nada que traducir
            return TranslateResponse(translation=req.text, model="")
        known = self.known(text, req.source, req.target)
        if known:
            return TranslateResponse(translation=known, model=DETERMINISTIC)
        prompt = f"Traduce del {LANGUAGE_NAMES[req.source]} al {LANGUAGE_NAMES[req.target]}:\n{text}"
        system = system_with_glossary(_SYSTEM, [text], req.source)
        data = await generate_json(self._llm, prompt, system=system, temperature=_TEMPERATURE)
        translation = self.accept(text, data, req.source, req.target)
        if translation is None and data is not None:  # [Reintento único]: el LLM respondió, pero mal (JSON, inglés, glosario)
            data = await generate_json(self._llm, prompt, system=f"{system}\n{STRICT_NOTE}", temperature=_TEMPERATURE)
            translation = self.accept(text, data, req.source, req.target)  # Sigue mal → «no disponible» (nunca basura en la UI)
        if translation is None:
            return TranslateResponse(translation="", model=UNAVAILABLE)
        register = (data or {}).get("register")
        alternatives = (data or {}).get("alternatives")
        return TranslateResponse(
            translation=translation,
            # `isinstance` + comprensión: solo alternativas de texto que no parezcan JSON
            alternatives=[a for a in (parse_translation(x) for x in (alternatives if isinstance(alternatives, list) else [])) if a][:3],
            tone=register if register in ("formal", "informal", "neutral") else "neutral",
            model=self._model,
        )

    async def translate_line(self, text: str, source: str) -> str | None:
        """Una línea al español (respaldo de EnrichLines); None si no se pudo. [Principio]: DRY (misma cadena que /translate)."""
        res = await self.execute(TranslateRequest(text=text[:500], source=source))  # type: ignore[arg-type]
        return res.translation or None
