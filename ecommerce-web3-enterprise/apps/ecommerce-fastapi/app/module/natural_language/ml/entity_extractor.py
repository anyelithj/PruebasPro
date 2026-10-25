# entity_extractor.py (spaCy EntityRuler + regex) => RF-17.2 entidades de un mensaje de chat:
#   PRODUCT  => lo que el cliente busca ("busco unos tenis negros" -> "tenis negros")
#   QUANTITY => cantidad en números o palabras ("2 unidades", "tres camisetas" -> 3)
#   ADDRESS  => dirección colombiana ("calle 10 # 5-20", "Cra 7 No. 45-10", "Av. Boyacá 12-30")
# + las entidades de soporte que ya reconoce email_parser (pedido, email, teléfono, monto, fecha).
# Patrón: Composite (une varios extractores) + Data-Driven (reglas como datos). DRY: reutiliza
# ner_extractor. Paradigma: funcional (funciones puras: texto -> lista de entidades).

import re
from typing import Any

from app.module.email_parser.ml import ner_extractor

NUMBER_WORDS = {
    "un": 1, "una": 1, "uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6,
    "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "par": 2,
}  # fmt: skip
UNITS = r"(?:unidades?|uds?\.?|pares?|piezas?|items?|x)"
QUANTITY = re.compile(
    rf"\b(\d{{1,3}}|{'|'.join(NUMBER_WORDS)})\s*(?:{UNITS}\b)?(?=\s+[a-záéíóúñ]{{3,}}|\s*{UNITS})",
    re.IGNORECASE,
)
# Dirección: tipo de vía + número + (#|No.|N°) + número-número
ADDRESS = re.compile(
    r"\b(?:calle|cl|carrera|cra|kr|cr|avenida|av|diagonal|dg|transversal|tv)\.?\s*\d+[a-z]?"
    r"(?:\s*bis)?\s*(?:#|no\.?|n°|nro\.?)\s*\d+[a-z]?\s*-\s*\d+",
    re.IGNORECASE,
)
# Producto: lo que sigue a un verbo de búsqueda/compra, hasta un conector o fin de frase
PRODUCT = re.compile(
    r"\b(?:busco|buscando|quiero|necesito|tienen|tienes|venden|comprar|looking for|"
    r"do you have|i want|i need)\s+(?:(?:un|una|unos|unas|el|la|los|las|a|an|some)\s+)?"
    r"(?:\d+\s+|(?:dos|tres|cuatro|cinco)\s+)?"
    r"([a-záéíóúñ][a-záéíóúñ ]{2,40}?)"
    r"(?=\s+(?:para|de color|talla|que|con|en|for|in|size)\b|[,.?!]|$)",
    re.IGNORECASE,
)


def _span(label: str, match: re.Match[str], group: int = 0, **extra: Any) -> dict[str, Any]:
    return {
        "label": label,
        "text": match.group(group).strip(),
        "start": match.start(group),
        "end": match.end(group),
        **extra,
    }


# extract => todas las entidades sin solapamientos (gana la que empieza antes y es más larga)
def extract(text: str) -> list[dict[str, Any]]:
    found = list(ner_extractor.extract(text))
    found += [_span("ADDRESS", m) for m in ADDRESS.finditer(text)]
    found += [_span("PRODUCT", m, 1) for m in PRODUCT.finditer(text)]
    for m in QUANTITY.finditer(text):
        raw = m.group(1).lower()
        value = int(raw) if raw.isdigit() else NUMBER_WORDS.get(raw, 1)
        found.append(_span("QUANTITY", m, 1, value=value))
    found.sort(key=lambda e: (e["start"], -(e["end"] - e["start"])))
    result: list[dict[str, Any]] = []
    for entity in found:
        if not result or entity["start"] >= result[-1]["end"]:
            result.append(entity)
    return result
