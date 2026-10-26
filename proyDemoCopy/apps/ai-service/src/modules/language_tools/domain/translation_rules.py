"""Reglas deterministas de la traducción al español: diccionario de respuestas cortas, glosario, español neutro y control de calidad.

[Patrón]: Lookup Table (MappingProxyType) + Specification (`is_acceptable`: ¿la salida del LLM es una traducción usable?).
[Principio]: determinístico primero (lo seguro no pasa por el LLM) + Fail Safe (salida dudosa → se reintenta o «no disponible», nunca basura).
[Paradigma]: Funcional (funciones puras, sin E/S).
[Bug 2026-10-25 · Temas de conversación]: «yes» → «yes»; «Bell pepper» → «Pepino verde»; «jalapeños, olives, onions» →
«jalones, aguacates, alubias»; «rooster's beak» → «cabeza de gallo»; «Preferís» (voseo); «el carne».
"""

import re
from types import MappingProxyType

from src.shared.domain.llm_output import looks_like_json
from src.shared.domain.text_norm import norm, words

# [Respuestas cortas]: «yes/no/ok…» por idioma de origen → español | modelos de 3–8B las devuelven sin traducir («yes» → «yes»)
SHORT_REPLIES = MappingProxyType(
    {
        "en": {
            "yes": "sí", "yeah": "sí", "yep": "sí", "yup": "sí", "no": "no", "nope": "no", "ok": "de acuerdo",
            "okay": "de acuerdo", "alright": "de acuerdo", "all right": "de acuerdo", "sure": "claro", "of course": "por supuesto",
            "thanks": "gracias", "thank you": "gracias", "thank you very much": "muchas gracias", "please": "por favor",
            "sorry": "lo siento", "i'm sorry": "lo siento", "maybe": "quizás", "perhaps": "quizás", "i don't know": "no lo sé",
            "me too": "yo también", "not really": "la verdad, no", "exactly": "exacto", "really": "¿en serio?", "yes please": "sí, por favor",
            "no thanks": "no, gracias", "no thank you": "no, gracias", "of course not": "claro que no",
        },
        "fr": {"oui": "sí", "non": "no", "merci": "gracias", "d'accord": "de acuerdo", "peut-être": "quizás", "bien sûr": "por supuesto"},
        "de": {"ja": "sí", "nein": "no", "danke": "gracias", "vielleicht": "quizás", "natürlich": "por supuesto", "genau": "exacto"},
        "pt": {"sim": "sí", "não": "no", "obrigado": "gracias", "obrigada": "gracias", "talvez": "quizás", "claro": "claro"},
    }
)

# [Glosario inglés → español]: comidas y términos que el LLM confundía; se inyecta en el prompt y valida la salida
GLOSSARY_EN = MappingProxyType(
    {
        "rooster's beak": "pico de gallo", "pico de gallo": "pico de gallo", "bell pepper": "pimiento morrón",
        "bell peppers": "pimientos morrones", "green pepper": "pimiento verde", "green peppers": "pimientos verdes",
        "red pepper": "pimiento rojo", "red peppers": "pimientos rojos", "jalapeño": "jalapeño", "jalapeños": "jalapeños",
        "jalapeno": "jalapeño", "jalapenos": "jalapeños", "olive": "aceituna", "olives": "aceitunas", "onion": "cebolla",
        "onions": "cebollas", "ground meat": "carne molida", "ground beef": "carne molida de res", "avocado": "aguacate",
        "avocados": "aguacates", "cucumber": "pepino", "beans": "frijoles", "cilantro": "cilantro", "coriander": "cilantro",
        "sour cream": "crema agria", "corn tortilla": "tortilla de maíz", "spicy": "picante", "tomato": "tomate",
        "tomatoes": "tomates", "chili": "chile", "chilli": "chile",
    }
)
GLOSSARIES = MappingProxyType({"en": GLOSSARY_EN})

# [Español neutro]: voseo frecuente → tuteo («Preferís» → «Prefieres») | lista cerrada: una regex genérica rompería «después», «inglés»…
_VOSEO = MappingProxyType(
    {
        "vos": "tú", "sos": "eres", "tenés": "tienes", "querés": "quieres", "podés": "puedes", "sabés": "sabes", "preferís": "prefieres",
        "decís": "dices", "hacés": "haces", "vivís": "vives", "comés": "comes", "hablás": "hablas", "venís": "vienes", "pensás": "piensas",
        "contás": "cuentas", "probás": "pruebas", "usás": "usas", "cocinás": "cocinas", "sentís": "sientes", "salís": "sales",
        "jugás": "juegas", "necesitás": "necesitas", "conocés": "conoces", "creés": "crees", "mirá": "mira", "decime": "dime",
        "contame": "cuéntame", "escuchá": "escucha", "llamás": "llamas", "trabajás": "trabajas", "estudiás": "estudias",
    }
)
# `\b…\b` (regex): palabra completa · `re.IGNORECASE`: «Preferís» y «preferís» · el grupo conserva la mayúscula al reemplazar
_VOSEO_RE = re.compile(r"\b(" + "|".join(sorted(_VOSEO, key=len, reverse=True)) + r")\b", re.IGNORECASE)
# [Concordancia]: «el carne» → «la carne» (sustantivos femeninos de comida que el modelo pequeño acompaña con «el»)
_FEMININE_RE = re.compile(r"\b(el|del|un)\s+(carne|salsa|cebolla|tortilla|comida|ensalada|sopa|fruta|verdura|aceituna)\b", re.IGNORECASE)
_ARTICLE_FIX = MappingProxyType({"el": "la", "del": "de la", "un": "una"})

# [Lite language-detect]: palabras funcionales del inglés que el español no usa → si dominan, la «traducción» sigue en inglés
_ENGLISH_MARKERS = frozenset(
    "the and is are was were you your my it this that with of to in for on do does what how why have has like i i'm don't it's very they we".split()
)
_TRAILING_PUNCT = re.compile(r"[\s.!?¡¿,;:…]+$")


def _key(text: str) -> str:
    """Clave de búsqueda: normalizada y sin signos al final («Yes!» → «yes»). [Paradigma]: función pura."""
    return _TRAILING_PUNCT.sub("", norm(text).strip("¡¿ "))


def _shape_like(source: str, translated: str) -> str:
    """Copia la forma del original: mayúscula inicial y signos («Yes?» → «¿Sí?», «Bell pepper» → «Pimiento morrón»)."""
    t = translated
    if source.rstrip().endswith("?") and not t.startswith("¿"):
        t = f"¿{t.strip('¿?')}?"
    elif source.rstrip().endswith("!") and not t.startswith("¡"):
        t = f"¡{t}!"
    elif source.rstrip().endswith(".") and not t.endswith("."):
        t = f"{t}."
    first = next((c for c in source if c.isalpha()), "")
    return _capitalize(t) if first.isupper() else t


def _capitalize(text: str) -> str:
    """Mayúscula en la primera letra aunque vaya tras «¿/¡». [Paradigma]: función pura."""
    for i, c in enumerate(text):
        if c.isalpha():
            return text[:i] + c.upper() + text[i + 1 :]
    return text


def quick_translation(text: str, source: str, target: str = "es") -> str | None:
    """Traducción determinista SIN LLM: respuesta corta («yes» → «Sí») o término exacto del glosario («Bell pepper»)."""
    if target != "es":
        return None
    key = _key(text)
    hit = SHORT_REPLIES.get(source, {}).get(key) or GLOSSARIES.get(source, {}).get(key)
    return _shape_like(text, hit) if hit else None


def glossary_hints(text: str, source: str) -> list[tuple[str, str]]:
    """Pares del glosario presentes en el texto (para el prompt): «rooster's beak» → «pico de gallo». [Paradigma]: función pura."""
    straight = text.replace("\u2019", "'")  # Apóstrofo tipográfico (’) → recto: «rooster’s» == «rooster's»
    plain = f" {' '.join(words(straight))} "
    found = {norm(k): (k, v) for k, v in GLOSSARIES.get(source, {}).items() if f" {norm(k)} " in plain}  # dict: «jalapeños» = «jalapenos» una vez
    return list(found.values())


def normalize_spanish(text: str) -> str:
    """Español neutro: voseo → tuteo y concordancia de «la carne». [Paradigma]: función pura."""
    def tuteo(m: re.Match[str]) -> str:  # `re.Match` (stdlib): conserva la mayúscula inicial del original
        word = _VOSEO[m.group(1).lower()]
        return _capitalize(word) if m.group(1)[0].isupper() else word

    def article(m: re.Match[str]) -> str:
        fixed = _ARTICLE_FIX[m.group(1).lower()]
        return f"{_capitalize(fixed) if m.group(1)[0].isupper() else fixed} {m.group(2)}"

    return _FEMININE_RE.sub(article, _VOSEO_RE.sub(tuteo, text))


def is_acceptable(source_text: str, translation: str | None, source: str, target: str = "es") -> bool:
    """¿La salida del LLM es una traducción usable? [Patrón]: Specification.

    Rechaza: vacío, JSON, copia del original (salvo nombres propios: «Mexico City»), texto que sigue en inglés y
    glosario ignorado («Bell pepper» sin «pimiento»).
    """
    if not translation or not translation.strip() or looks_like_json(translation):
        return False
    src_words, out_words = words(source_text), words(translation)
    if not out_words:
        return False
    if _key(source_text) == _key(translation):  # Idéntica: solo vale para nombres propios y números
        proper = all(w[:1].isupper() or w.isdigit() for w in source_text.split())
        return proper and _key(source_text) not in SHORT_REPLIES.get(source, {})
    if target == "es" and source == "en" and len(out_words) >= 3:
        if sum(w in _ENGLISH_MARKERS for w in out_words) / len(out_words) >= 0.3:  # Sigue en inglés
            return False
    if len(out_words) >= 3 and sum(w in set(src_words) for w in out_words) / len(out_words) >= 0.8:  # Copia casi literal
        return False
    if target != "es":
        return True
    # Glosario: cada término del original debe aparecer con su equivalente — basta la raíz de su primera palabra
    # («picante» acepta «picantes»; «pico de gallo» rechaza «cabeza de gallo») | `str.startswith` sobre cada palabra
    return all(any(w.startswith(norm(v).split()[0][:5]) for w in out_words) for _, v in glossary_hints(source_text, source))
