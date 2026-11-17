"""¿El alumno pregunta cómo se pronuncia algo? → qué palabras (Tarea 9 · Pronunciación).

La pronunciación NO se responde con el RAG: se consulta el diccionario fonético (espeak-ng, equivalente multilingüe de CMUdict para
los 7 idiomas) y el tutor recibe la IPA exacta → no depende de que un fragmento recuperado mencione esa palabra.
[Patrón]: Specification (regex) + Value Object | [Principio]: Deterministic-first | [Paradigma]: Funcional (función pura).
"""

import re  # stdlib: expresiones regulares

# «¿cómo se pronuncia "niece"?», «pronunciación de kitchen», «how do you pronounce hour», «cómo se dice/lee "thought"»
_ASK = re.compile(
    r"(?:c[oó]mo\s+se\s+(?:pronuncia[n]?|lee[n]?|dice[n]?\s+en\s+voz\s+alta)|pronunciaci[oó]n\s+de|how\s+(?:do\s+(?:you|i)\s+)?pronounce|"
    r"how\s+is\s+\S+\s+pronounced)\s*[:\-]?\s*(?P<target>.+)",
    re.IGNORECASE,
)
_QUOTED = re.compile(r"[\"“«'‘]([^\"”»'’]{1,60})[\"”»'’]")  # Texto entre comillas: lo que el alumno quiere oír
_WORD = re.compile(r"[^\W\d_][\w'’-]*")  # Palabras (cualquier alfabeto), con apóstrofo o guion internos
_FILLER = frozenset({"la", "el", "los", "las", "palabra", "palabras", "the", "word", "en", "in", "ingles", "inglés", "frances", "francés", "aleman",
                     "alemán", "portugues", "portugués", "chino", "ruso", "english", "french", "german", "correctamente", "bien"})  # fmt: skip
MAX_WORDS = 6  # Una palabra o una frase corta; más ya no es una consulta de pronunciación


def pronunciation_targets(message: str) -> list[str]:
    """Palabras cuya pronunciación pregunta el alumno ([] si no pregunta por pronunciación). Función pura."""
    quoted = _QUOTED.findall(message)
    match = _ASK.search(message)
    if not match:
        return []
    source = " ".join(quoted) if quoted else match.group("target")
    words = [w for w in _WORD.findall(source) if w.casefold() not in _FILLER]
    return words[:MAX_WORDS]
