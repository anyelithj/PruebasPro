"""Caso de uso: traducir un término o una frase con el LLM local.

[Patrón]: Use Case (Command) + Port (LlmPort) + Chain of Responsibility (diccionario → caché → LLM → reintento → «no disponible»)
+ Specification (`is_acceptable`).
[Principio]: SRP + DIP + determinístico primero (origen = destino, respuestas cortas y glosario → sin LLM) + Fail Safe
(una salida dudosa se reintenta UNA vez; si sigue mal, «no disponible» en vez de basura en la UI).
[Paradigma]: POO + asíncrono.
[Bug 2026-10-25]: JSON crudo como traducción, «yes» → «yes», «Bell pepper» → «Pepino verde», voseo y «el carne» (ver translation_rules).
"""

from collections.abc import Awaitable, Callable  # stdlib: tipo del puerto de referencias (función async)
import json  # stdlib: la caché guarda las tres opciones de un título/expresión como texto JSON
from types import MappingProxyType

from src.modules.language_tools.application.schemas.translate_request import TranslateRequest, TranslateResponse, TranslationOption
from src.modules.language_tools.domain.interfaces.llm_client import LlmPort
from src.modules.language_tools.domain.interfaces.translation_cache import TranslationCachePort
from src.modules.language_tools.domain.translation_rules import curated_options, glossary_hints, is_acceptable, normalize_spanish, quick_translation
from src.modules.own_llm.domain.rules import opening_marks  # [2026-11-13]: ¿? y ¡! completos con la MISMA regla del corrector (DRY)
from src.shared.clients.llm_json import generate_json
from src.shared.domain.language_detect import resolve_language
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
    "«rooster's beak» → «pico de gallo», «jalapeños» → «jalapeños»); "
    # [2026-11-10 · «¿Cómo está la comida en Colombia?» suena a comida dañada]: frases como las diría un hablante nativo, no palabra por palabra
    "traduce el SENTIDO con la frase natural que diría un hablante nativo, no palabra por palabra («How is the food in Colombia?» → "
    "«¿Qué tal la comida en Colombia?», «What's your name?» → «¿Cómo te llamas?», «I'm from Colombia» → «Soy de Colombia», «I am ten years old» → «Tengo diez años»); "
    "no expliques, no añadas comillas ni texto extra."
)
_SYSTEM = (
    f"Eres un traductor profesional. {TRANSLATION_RULES}\n"
    'Devuelve SOLO JSON: {"translation": "...", "alternatives": ["hasta 3 alternativas cortas"], "register": "formal|informal|neutral"}.\n'
    "Ejemplos:\n"
    '«Do you prefer tacos or burritos?» → {"translation": "¿Prefieres tacos o burritos?", "alternatives": [], "register": "informal"}\n'
    '«I like ground meat spicy, with vegetables.» → {"translation": "Me gusta la carne molida picante, con verduras.", "alternatives": [], "register": "neutral"}\n'
    '«Bell pepper, jalapeños, olives and onions.» → {"translation": "Pimiento morrón, jalapeños, aceitunas y cebollas.", "alternatives": [], "register": "neutral"}'
)
# [Frase corta · 2026-11-13]: títulos de tema y términos sueltos tardaban lo mismo que un párrafo (prompt largo con ejemplos + alternativas + 300 tokens)
# → prompt mínimo, solo {"translation"} y pocos tokens: menos prefill y menos generación en CPU | [Principio]: rendimiento proporcional al texto
_SHORT_MAX_WORDS = 8
_SHORT_MAX_TOKENS = 48
_SYSTEM_SHORT = (
    "Eres un traductor profesional para estudiantes hispanohablantes. Español neutro con «tú»; traduce el sentido con la "
    'forma natural; mantén nombres propios. Devuelve SOLO JSON: {"translation": "..."}.'
)
# [Títulos y expresiones · 2026-11-13 · Caso C]: tres opciones en vez de una literal («Hands To Myself» → «Manos a mí»)
_SYSTEM_OPTIONS = (
    f"Eres un traductor profesional de títulos (canciones, películas, libros) y expresiones idiomáticas. {TRANSLATION_RULES}\n"
    "No traduzcas palabra por palabra. Devuelve SOLO JSON con tres opciones en español: "
    '{"natural": "cómo lo diría o titularía un hispanohablante (la recomendada)", "cercana": "el mismo sentido con palabras más cercanas al original", '
    '"literal": "palabra por palabra"}.\n'
    'Ejemplo: «Break a leg!» → {"natural": "¡Mucha suerte!", "cercana": "¡Que te vaya muy bien!", "literal": "Rómpete una pierna"}'
)
_OPTION_ORDER = ("natural", "cercana", "literal")
# [Reintento]: orden más estricta cuando la primera salida no pasó el control de calidad
STRICT_NOTE = "IMPORTANTE: tu respuesta anterior no era una traducción válida al español. Escribe SOLO la traducción al español, completa."
UNAVAILABLE = "unavailable"  # Modelo cuando el LLM no respondió (la UI muestra el IPA y avisa)
DETERMINISTIC = "dictionary"  # Modelo cuando tradujo el diccionario/glosario (sin LLM)
_TEMPERATURE = 0.1  # Baja: la traducción no debe «inventar» (antes 0.2 por defecto)


def system_with_glossary(base: str, texts: list[str], source: str) -> str:
    """Añade al prompt de sistema los equivalentes del glosario presentes en los textos. [Principio]: DRY (lote y frase suelta)."""
    hints = {k: v for t in texts for k, v in glossary_hints(t, source)}  # Comprensión de dict: sin duplicados entre líneas
    return base if not hints else base + "\nUsa estos equivalentes: " + "; ".join(f"«{k}» → «{v}»" for k, v in hints.items()) + "."


# [Port · Tarea 9]: fragmentos del RAG (frases y expresiones revisadas) → [(id, texto con fuente)] | función async inyectada (DIP)
ReferenceLookup = Callable[[str, str, str | None], Awaitable[list[tuple[str, str]]]]


async def reference_block(lookup: ReferenceLookup | None, text: str, source: str) -> tuple[str, list[str]]:
    """Bloque «REFERENCIAS» para el prompt + ids usados. Sin RAG, sin material o con fallo → ("", []) y se traduce igual."""
    if lookup is None:
        return "", []
    try:
        found = (await lookup(text, source, None))[:5]
    except Exception:  # noqa: BLE001 — el RAG nunca bloquea la traducción
        return "", []
    if not found:
        return "", []
    lines = "\n".join(f"- {t}" for _, t in found)
    return f"REFERENCIAS (traducciones revisadas del curso; úsalas como guía de sentido, no las copies):\n{lines}\n\n", [i for i, _ in found]


class TranslateTextUseCase:
    def __init__(self, llm: LlmPort, model: str, cache: TranslationCachePort | None = None, references: ReferenceLookup | None = None) -> None:
        self._references = references  # [Tarea 9]: None = sin RAG (tests y lote de EnrichLines)
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
        """Limpia la salida del LLM (JSON, comillas, voseo, ¿¡ que falten) y la valida; si pasa, la cachea. None = no usable."""
        cleaned = parse_translation(raw, text)
        fixed = opening_marks(normalize_spanish(cleaned)) if cleaned and target == "es" else cleaned  # «Mucho gusto!» → «¡Mucho gusto!»
        if not is_acceptable(text, fixed, source, target):
            return None
        if self._cache and fixed:
            self._cache.put(text, source, fixed, target)
        return fixed

    async def execute(self, req: TranslateRequest) -> TranslateResponse:
        # [Detectar idioma · 2026-10-27]: «auto» → idioma detectado (sin LLM) y el resto de la cadena trabaja con un código real
        source, detected = resolve_language(req.source, req.text)
        res = await self._translate(req.model_copy(update={"source": source}))  # `model_copy(update=…)` (Pydantic v2): DTO frozen → copia nueva
        return res.model_copy(update={"detected_language": detected}) if detected else res

    async def _translate(self, req: TranslateRequest) -> TranslateResponse:
        text = req.text.strip()
        if req.source == req.target:  # [Determinístico]: nada que traducir
            return TranslateResponse(translation=req.text, model="")
        if req.tipo_de_texto != "frase" and req.target == "es":
            return await self._options(text, req.source)
        known = self.known(text, req.source, req.target)
        if known:
            return TranslateResponse(translation=known, model=DETERMINISTIC)
        # [Contexto · 2026-11-13]: la conversación aclara el sentido («What's your name?» antes de «my name is…») pero no se traduce
        about = f"Contexto de la conversación (NO lo traduzcas):\n{req.context.strip()}\n\n" if req.context.strip() else ""
        refs, used = await reference_block(self._references, text, req.source)  # [Tarea 9]: frases y expresiones revisadas como guía
        prompt = f"{refs}{about}Traduce del {LANGUAGE_NAMES[req.source]} al {LANGUAGE_NAMES[req.target]}:\n{text}"
        short = len(text.split()) <= _SHORT_MAX_WORDS
        system = system_with_glossary(_SYSTEM_SHORT if short else _SYSTEM, [text], req.source)
        max_tokens = _SHORT_MAX_TOKENS if short else 300
        data = await generate_json(self._llm, prompt, system=system, max_tokens=max_tokens, temperature=_TEMPERATURE)
        translation = self.accept(text, data, req.source, req.target)
        if translation is None and data is not None:  # [Reintento único]: el LLM respondió, pero mal (JSON, inglés, glosario)
            data = await generate_json(self._llm, prompt, system=f"{system}\n{STRICT_NOTE}", max_tokens=max_tokens, temperature=_TEMPERATURE)
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
            references=used,
        )

    async def translate_line(self, text: str, source: str, context: str = "") -> str | None:
        """Una línea al español (respaldo de EnrichLines y del corrector); None si no se pudo. [Principio]: DRY (misma cadena que /translate)."""
        res = await self.execute(TranslateRequest(text=text[:500], source=source, context=context[:600]))  # type: ignore[arg-type]
        return res.translation or None

    async def _options(self, text: str, source: str) -> TranslateResponse:
        """Título/expresión → natural (recomendada), cercana y literal: curadas → caché → LLM (con un reintento). [Patrón]: Chain of Responsibility."""
        found: tuple[str, ...] | None = curated_options(text, source)
        model = DETERMINISTIC
        slot = "es|opciones"  # Clave de caché propia: (texto, idioma, tipo) → la frase suelta no pisa sus opciones
        if found is None and self._cache and (hit := self._cache.get(text, source, slot)):
            found, model = tuple(json.loads(hit)), "cache"
        refs, used = await reference_block(self._references, text, source) if found is None else ("", [])
        for strict in ("", f"\n{STRICT_NOTE}"):
            if found is not None:
                break
            data = await generate_json(self._llm, f"{refs}Título o expresión en {LANGUAGE_NAMES[source]}:\n{text}", system=_SYSTEM_OPTIONS + strict, max_tokens=160, temperature=_TEMPERATURE)
            opts = tuple(opening_marks(normalize_spanish(parse_translation((data or {}).get(k), text) or "")) for k in _OPTION_ORDER)
            if all(opts) and is_acceptable(text, opts[0], source):  # Las tres presentes y la natural no es copia ni sigue en el idioma original
                found, model = opts, self._model
                if self._cache:
                    self._cache.put(text, source, json.dumps(opts, ensure_ascii=False), slot)
        if found is None:
            return TranslateResponse(translation="", model=UNAVAILABLE)
        options = [TranslationOption(tipo=k, texto=v) for k, v in zip(_OPTION_ORDER, found, strict=True)]  # type: ignore[arg-type]
        return TranslateResponse(translation=found[0], options=options, model=model, references=used)
