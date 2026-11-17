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
            # [2026-11-13 · Caso C]: fórmula de cortesía → equivalente natural (no «mucho gusto de conocerte»)
            "nice to meet you": "mucho gusto", "nice to meet you too": "igualmente, mucho gusto",
        },
        "fr": {"oui": "sí", "non": "no", "merci": "gracias", "d'accord": "de acuerdo", "peut-être": "quizás", "bien sûr": "por supuesto", "enchanté": "mucho gusto", "enchantée": "mucho gusto"},
        "de": {"ja": "sí", "nein": "no", "danke": "gracias", "vielleicht": "quizás", "natürlich": "por supuesto", "genau": "exacto", "freut mich": "mucho gusto"},
        "pt": {"sim": "sí", "não": "no", "obrigado": "gracias", "obrigada": "gracias", "talvez": "quizás", "claro": "claro", "muito prazer": "mucho gusto", "prazer": "mucho gusto"},
        "ru": {"да": "sí", "нет": "no", "спасибо": "gracias", "пожалуйста": "por favor", "очень приятно": "mucho gusto"},
        "zh": {"是": "sí", "不是": "no", "谢谢": "gracias", "请": "por favor", "很高兴认识你": "mucho gusto"},
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
# [Parentesco · 2026-11-13 · Caso A]: «niece» se traducía «prima» y luego «nieta» → equivalentes curados en los 7 idiomas (temperatura baja + glosario
# en el prompt + validación de la salida) | ponytail: términos inequívocos; «cousin», «belle-mère»… dependen del contexto y los resuelve el LLM
KINSHIP = MappingProxyType({
    "en": {"niece": "sobrina", "nieces": "sobrinas", "nephew": "sobrino", "nephews": "sobrinos", "granddaughter": "nieta", "grandson": "nieto",
           "grandchildren": "nietos", "aunt": "tía", "uncle": "tío", "mother-in-law": "suegra", "father-in-law": "suegro",
           "son-in-law": "yerno", "daughter-in-law": "nuera", "brother-in-law": "cuñado", "sister-in-law": "cuñada",
           "stepmother": "madrastra", "stepfather": "padrastro"},
    "fr": {"nièce": "sobrina", "neveu": "sobrino", "petite-fille": "nieta", "petit-fils": "nieto", "tante": "tía", "oncle": "tío"},
    "de": {"nichte": "sobrina", "neffe": "sobrino", "enkelin": "nieta", "enkel": "nieto", "tante": "tía", "onkel": "tío",
           "schwiegermutter": "suegra", "schwiegervater": "suegro"},
    "pt": {"sobrinha": "sobrina", "sobrinho": "sobrino", "neta": "nieta", "neto": "nieto", "tia": "tía", "tio": "tío", "sogra": "suegra", "sogro": "suegro"},
    "ru": {"племянница": "sobrina", "племянник": "sobrino", "внучка": "nieta", "внук": "nieto", "тётя": "tía", "тетя": "tía", "дядя": "tío"},
    "zh": {"侄女": "sobrina", "外甥女": "sobrina", "侄子": "sobrino", "外甥": "sobrino", "孙女": "nieta", "孙子": "nieto"},
})  # fmt: skip
# `{**a, **b}` (PEP 448): une glosarios temáticos por idioma sin duplicar datos | [Principio]: OCP (un tema = un mapa más)
GLOSSARIES = MappingProxyType({lang: MappingProxyType({**(GLOSSARY_EN if lang == "en" else {}), **kin}) for lang, kin in KINSHIP.items()})

# [Expresiones y títulos · 2026-11-13 · Caso C]: (natural, cercana, literal) curadas → deterministas, sin LLM («Hands To Myself» ≠ «Manos a mí»)
# Natural = cómo lo diría un hispanohablante (la recomendada) · cercana = el sentido con otras palabras · literal = palabra por palabra
EXPRESSIONS = MappingProxyType({
    "en": {
        "hands to myself": ("No puedo contenerme", "No puedo mantener mis manos quietas", "Mis manos para mí"),
        "it's raining cats and dogs": ("Está lloviendo a cántaros", "Está lloviendo muchísimo", "Está lloviendo gatos y perros"),
        "raining cats and dogs": ("Lloviendo a cántaros", "Lloviendo muchísimo", "Lloviendo gatos y perros"),
        "break a leg": ("¡Mucha suerte!", "¡Que te vaya muy bien!", "Rómpete una pierna"),
        "piece of cake": ("Pan comido", "Muy fácil", "Pedazo de pastel"),
        "it's a piece of cake": ("Es pan comido", "Es muy fácil", "Es un pedazo de pastel"),
        "under the weather": ("Indispuesto", "Un poco enfermo", "Bajo el clima"),
        "once in a blue moon": ("De higos a brevas", "Muy de vez en cuando", "Una vez en una luna azul"),
        "call it a day": ("Dar por terminado el día", "Dejarlo por hoy", "Llamarlo un día"),
    },
    "fr": {
        "il pleut des cordes": ("Está lloviendo a cántaros", "Llueve muchísimo", "Llueve cuerdas"),
        "coûter les yeux de la tête": ("Costar un ojo de la cara", "Ser carísimo", "Costar los ojos de la cabeza"),
    },
    "de": {
        "daumen drücken": ("Cruzar los dedos", "Desear suerte", "Apretar los pulgares"),
        "tomaten auf den augen haben": ("No ver lo que tienes delante", "No darse cuenta de algo evidente", "Tener tomates en los ojos"),
    },
    "pt": {
        "chover canivetes": ("Llover a cántaros", "Llover muchísimo", "Llover navajas"),
        "pagar o pato": ("Pagar los platos rotos", "Cargar con la culpa", "Pagar el pato"),
    },
    "ru": {"ни пуха ни пера": ("¡Mucha suerte!", "¡Que te vaya bien!", "Ni pelusa ni pluma")},
    "zh": {"马马虎虎": ("Más o menos", "Regular", "Caballo caballo tigre tigre"), "加油": ("¡Ánimo!", "¡Tú puedes!", "Añade aceite")},
})  # fmt: skip

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
# [2026-11-09]: palabras francesas que NO existen en español → si quedan en la salida, la línea se quedó a medio traducir («Qui me fascina»)
_FRENCH_MARKERS = frozenset("qui je nous vous ils elles est sont avec dans mais comme très être avoir mon ton cœur coeur où oui pas ne ce cette du au aux".split())
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


def _normalized(tables: MappingProxyType) -> MappingProxyType:  # type: ignore[type-arg]
    """Tablas por idioma con las claves normalizadas igual que la búsqueda («Nièce» → «niece», «Daumen drücken») | se calcula una vez."""
    return MappingProxyType({lang: MappingProxyType({_key(k): v for k, v in table.items()}) for lang, table in tables.items()})


_QUICK_SHORT = _normalized(SHORT_REPLIES)
_QUICK_GLOSSARY = _normalized(GLOSSARIES)
_QUICK_EXPRESSIONS = _normalized(EXPRESSIONS)


def quick_translation(text: str, source: str, target: str = "es") -> str | None:
    """Traducción determinista SIN LLM: respuesta corta («yes» → «Sí») o término exacto del glosario («Bell pepper», «niece»)."""
    if target != "es":
        return None
    key = _key(text)
    hit = _QUICK_SHORT.get(source, {}).get(key) or _QUICK_GLOSSARY.get(source, {}).get(key)
    return _shape_like(text, hit) if hit else None


def curated_options(text: str, source: str) -> tuple[str, str, str] | None:
    """(natural, cercana, literal) de una expresión o título curado; None si no está en la tabla. Función pura."""
    return _QUICK_EXPRESSIONS.get(source, {}).get(_key(text))


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
    if target == "es" and source == "fr" and any(w in _FRENCH_MARKERS for w in out_words):  # Sigue (en parte) en francés
        return False
    if len(out_words) >= 3 and sum(w in set(src_words) for w in out_words) / len(out_words) >= 0.8:  # Copia casi literal
        return False
    if target != "es":
        return True
    # Glosario: cada término del original debe aparecer con su equivalente — basta la raíz de su primera palabra
    # («picante» acepta «picantes»; «pico de gallo» rechaza «cabeza de gallo») | `str.startswith` sobre cada palabra
    return all(any(w.startswith(norm(v).split()[0][:5]) for w in out_words) for _, v in glossary_hints(source_text, source))
