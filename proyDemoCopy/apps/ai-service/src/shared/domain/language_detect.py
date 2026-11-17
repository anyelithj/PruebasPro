"""Detección del idioma de un texto entre los 7 de la plataforma (Traductor «Detectar idioma» y Corrector de redacciones).

[Patrón]: Chain of Responsibility (escritura → marcadores → langdetect → idioma por defecto) + Shared Kernel (lo usan LanguageTools y OwnLlm).
[Principio]: determinístico primero (sin LLM: < 1 ms) + Fail Safe (nunca lanza; si duda devuelve el idioma por defecto con confianza baja).
[Paradigma]: Funcional (funciones puras, sin E/S).
[Tecnología · 2026-10-27]: `langdetect` (puerto Python del detector de Google, Apache-2.0) solo para textos largos; en palabras sueltas
falla («hello» → finés, «umbrella» → italiano), por eso antes van la escritura (cirílico/CJK) y los marcadores (palabras funcionales y letras).
"""

import re
from dataclasses import dataclass
from types import MappingProxyType

from src.shared.domain.text_norm import words

try:  # [Dependencia opcional]: sin langdetect el detector sigue funcionando con las dos primeras reglas | [Principio]: Graceful Degradation
    from langdetect import DetectorFactory, LangDetectException, detect_langs

    DetectorFactory.seed = 0  # `seed` (langdetect): resultados deterministas (por defecto muestrea al azar)
except ImportError:  # pragma: no cover - depende del entorno
    detect_langs = None  # type: ignore[assignment]

    class LangDetectException(Exception):  # type: ignore[no-redef]
        """Sustituto para que el `except` funcione sin la librería."""


SUPPORTED = ("en", "es", "fr", "de", "pt", "zh", "ru")  # Espejo de LanguageCode (language_voices) y del enum Language de NestJS
DEFAULT = "en"  # Idioma más estudiado en la plataforma → respuesta cuando no hay evidencia

# [Escritura]: `\u0400-\u04FF` (Unicode Cyrillic) · `\u4E00-\u9FFF` (CJK Unified Ideographs) → sin ambigüedad entre los 7 idiomas
_CYRILLIC = re.compile(r"[\u0400-\u04FF]")
_CJK = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF]")

# [Marcadores]: palabras funcionales frecuentes y casi exclusivas de cada idioma | `MappingProxyType` (stdlib): tabla de solo lectura
_MARKERS = MappingProxyType(
    {
        "en": frozenset(
            "the and is are was were you your my it this that with of to in for on do does what how why have has i i'm don't "
            "it's they we he she be will would can hello hi thanks thank please yes not but at from by "
            # [Fix 2026-10-28]: palabras frecuentes en redacciones de principiantes («i m ana», «my name ana») · sin «am» (también alemán: «am Montag»)
            "im name live like want go went very there their because when where who".split()
        ),
        "es": frozenset(
            "el la los las que es está estás por para con una unos pero muy también como cómo qué hola gracias sí del al "
            "yo tú usted ellos nosotros tiene hay son estoy soy "
            # [Fix 2026-10-28]: «mi nombre es Ana» empataba es↔de por «es» y caía al idioma por defecto (inglés) → más palabras exclusivas del español
            # (sin «me», «vivo», «porque», «nunca», «este», «amigo», «bien»: también son portugués o francés)
            "mi mis llamo nombre tengo años buenos buenas días adiós hasta luego mucho mucha cuando donde dónde "
            "ella él eso ese aquí ahora siempre quiero puedo hermano hermana".split()
        ),
        "fr": frozenset(
            "le les est et je tu vous nous il elle une des du au aux pas c'est ce qui que mais très avec pour sur bonjour "
            "merci oui suis sont j'ai salut bonsoir appelle".split()
        ),
        "de": frozenset(
            "der die das und ist ich du sie wir nicht ein eine mit für auf ja nein danke bitte guten morgen tag wie geht "
            "es dir mir auch sehr bin sind haben "
            # [Fix 2026-11-03]: «hallo» en el traductor salía inglés (caía al idioma por defecto) → saludos y verbos frecuentes de principiantes
            "hallo tschüss tschüs heiße wohne komme kommst gut".split()
        ),
        "pt": frozenset(
            "o os um uma é não você eu com para por muito obrigado obrigada olá sim também mas está são tem do da dos das "
            "pela pelo isso oi tchau sou".split()
        ),
    }
)
# [Letras delatoras]: «ñ ¿ ¡» español · «ã õ» portugués · «ß ä ö ü» alemán · «è ê à ù û ç œ» francés (ç también en pt → peso menor)
_LETTERS = MappingProxyType(
    {"es": "ñ¿¡", "pt": "ãõ", "de": "ßäöü", "fr": "èêàùûœëïîâ"}
)
# [Fix 2026-10-28 · Hermanos]: idiomas que langdetect devuelve por error en textos cortos → el de la plataforma más parecido
# `MappingProxyType` (stdlib): solo lectura | ca/gl/it/ast/an → español · oc → francés · nl/lb/af → alemán
_SIBLINGS = MappingProxyType({"ca": "es", "gl": "es", "it": "es", "ast": "es", "an": "es", "oc": "fr", "nl": "de", "lb": "de", "af": "de"})
_MIN_LANGDETECT = 12  # Caracteres desde los que langdetect es fiable
_MIN_PROB = 0.4  # Probabilidad mínima de langdetect para aceptar su respuesta (texto largo)
_MIN_PROB_SHORT = 0.9  # Palabra suelta: solo si está casi seguro («casa» → es 0.99; «umbrella» → it 0.86 no pasa, ni es de los 7)


@dataclass(frozen=True, slots=True)  # `frozen` + `slots` (stdlib): Value Object inmutable y ligero
class Detection:
    language: str
    confidence: float  # 0–1 (heurística) · la UI solo la usa para avisar si es baja
    method: str  # script | markers | langdetect | default → trazabilidad


def _marker_scores(text: str) -> dict[str, float]:
    """Puntos por idioma: palabras funcionales (1) + letras delatoras (2). [Paradigma]: función pura."""
    lowered = text.lower()
    tokens = re.findall(r"[\w'’-]+", lowered)  # Sin normalizar tildes: «está» ≠ «esta»
    scores = {lang: float(sum(t in vocab for t in tokens)) for lang, vocab in _MARKERS.items()}
    for lang, letters in _LETTERS.items():
        scores[lang] += 2.0 * sum(lowered.count(c) for c in letters)
    return scores


def _by_langdetect(text: str, among: frozenset[str] | None = None) -> Detection | None:
    """langdetect restringido a los 7 idiomas (zh-cn/zh-tw → zh). None si no está instalado o no es concluyente.

    `among` (opcional): desempate entre los idiomas que empataron por marcadores → acepta el primero de ellos sin umbral.
    """
    if detect_langs is None or not text.strip():
        return None
    threshold = _MIN_PROB if len(text.strip()) >= _MIN_LANGDETECT else _MIN_PROB_SHORT
    try:
        ranked = detect_langs(text)
    except LangDetectException:  # Texto sin rasgos (solo números o signos)
        return None
    # [Fix 2026-10-28 · Hermanos]: en frases cortas langdetect confunde el español con catalán/italiano («me llamo Ana» → it 0.99)
    # → un idioma vecino fuera de la plataforma cuenta como el soportado más cercano | [Patrón]: Lookup Table (_SIBLINGS)
    candidates = [(_SIBLINGS.get(c.lang.split("-")[0], c.lang.split("-")[0]), c.prob) for c in ranked]  # Ordenados de mayor a menor probabilidad
    if among:
        return next((Detection(code, round(prob, 2), "langdetect") for code, prob in candidates if code in among), None)
    for code, prob in candidates:
        if code in SUPPORTED and prob >= threshold:
            return Detection(code, round(prob, 2), "langdetect")
    return None


def detect_language(text: str) -> Detection:
    """Idioma más probable de `text` entre SUPPORTED. Nunca lanza. [Patrón]: Chain of Responsibility."""
    if _CJK.search(text):
        return Detection("zh", 0.99, "script")
    if _CYRILLIC.search(text):
        return Detection("ru", 0.99, "script")
    scores = _marker_scores(text)
    best = max(scores, key=lambda k: scores[k])  # `max(key=…)`: idioma con más puntos
    ranked = sorted(scores.values(), reverse=True)
    n_words = max(len(words(text)), 1)
    # [Ganador claro]: al menos 1 punto y ventaja sobre el segundo → fiable incluso con 1–3 palabras («Hola», «Danke schön»)
    if ranked[0] >= 1 and ranked[0] > ranked[1]:
        lead = (ranked[0] - ranked[1]) / (ranked[0] + n_words)
        # Texto largo con poca ventaja → se contrasta con langdetect (más preciso con frases completas)
        if lead < 0.15 and (alt := _by_langdetect(text)):  # `:=` (walrus, Python 3.8): asigna y evalúa en la condición
            return alt
        return Detection(best, round(min(0.95, 0.6 + lead), 2), "markers")
    # [Fix 2026-10-28 · Empate]: antes un empate (p. ej. «es» cuenta para español y alemán) acababa en el idioma por defecto (inglés)
    # → langdetect decide SOLO entre los empatados; si no se pronuncia, gana el primero empatado (orden estable de _MARKERS)
    if ranked[0] >= 1:
        tied = frozenset(k for k, v in scores.items() if v == ranked[0])
        if alt := _by_langdetect(text, among=tied):
            return Detection(alt.language, 0.5, "langdetect")
        if (general := _by_langdetect(text)) is not None:
            return general
        return Detection(next(k for k in _MARKERS if k in tied), 0.4, "markers")
    return _by_langdetect(text) or Detection(DEFAULT, 0.3, "default")


def resolve_language(language: str, text: str) -> tuple[str, str | None]:
    """`"auto"` → (idioma detectado, idioma detectado); otro código → (código, None). [Principio]: DRY (Traductor y Corrector)."""
    if language != "auto":
        return language, None
    detected = detect_language(text).language
    return detected, detected
