# query_normalizer.py (Python estándar: difflib + unicodedata) => RF-17.9 corrige la ortografía y
# amplía con sinónimos las consultas del chatbot ANTES de detectar la intención o buscar en el
# catálogo. "tenis negors" -> "tenis negros" (+ "zapatillas", "sneakers").
# Corrección: cada palabra desconocida se reemplaza por la más parecida del vocabulario (ratio de
# Ratcliff/Obershelp >= 0.8 con difflib.get_close_matches: stdlib, 0 dependencias). El vocabulario
# = palabras de los ejemplos de intención + sinónimos + términos que aprende el entrenamiento.
# Patrón: Pipeline (normalizar -> corregir -> expandir) + Data-Driven (sinónimos como datos).
# Paradigma: funcional (funciones puras sin estado; el vocabulario se pasa como parámetro).

import re
import unicodedata
from difflib import get_close_matches

# SYNONYMS => grupos de términos equivalentes (español/inglés). Cada palabra del grupo expande a
# las demás: la búsqueda encuentra "zapatillas" aunque el cliente escriba "tenis".
SYNONYM_GROUPS: list[set[str]] = [
    {"tenis", "zapatillas", "sneakers", "deportivos"},
    {"camiseta", "playera", "remera", "polo", "tshirt"},
    {"pantalon", "jean", "jeans", "vaquero"},
    {"chaqueta", "chamarra", "campera", "jacket"},
    {"bolso", "cartera", "bag"},
    {"reloj", "watch", "smartwatch"},
    {"celular", "telefono", "movil", "smartphone"},
    {"pedido", "orden", "compra", "order"},
    {"envio", "despacho", "entrega", "shipping"},
    {"devolucion", "reembolso", "cambio", "return", "refund"},
    {"barato", "economico", "oferta", "descuento", "cheap"},
    {"asesor", "agente", "humano", "persona"},
]
SYNONYMS: dict[str, set[str]] = {word: group - {word} for group in SYNONYM_GROUPS for word in group}
MIN_WORD = 4  # Palabras cortas ("de", "la", "mi") no se corrigen: demasiados falsos positivos
CUTOFF = 0.8  # Similitud mínima para aceptar una corrección


# strip_accents => "envío" -> "envio" (comparación sin tildes; el texto original no se altera)
def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-záéíóúüñ0-9]+", text.lower())


# build_vocabulary => conjunto de palabras conocidas (sin tildes) a partir de textos de ejemplo
def build_vocabulary(texts: list[str]) -> set[str]:
    words = {strip_accents(w) for text in texts for w in tokenize(text)}
    return words | set(SYNONYMS)


# normalize_query => (texto corregido, correcciones {mal: bien}, sinónimos agregados)
def normalize_query(text: str, vocabulary: set[str]) -> tuple[str, dict[str, str], list[str]]:
    corrections: dict[str, str] = {}
    fixed: list[str] = []
    known = sorted(vocabulary)  # get_close_matches necesita una secuencia
    for word in tokenize(text):
        plain = strip_accents(word)
        if len(plain) >= MIN_WORD and plain not in vocabulary and not plain.isdigit():
            match = get_close_matches(plain, known, n=1, cutoff=CUTOFF)
            if match:
                corrections[word] = match[0]
                plain = match[0]
        fixed.append(plain)
    expansions = sorted({syn for word in fixed for syn in SYNONYMS.get(word, set())} - set(fixed))
    return " ".join(fixed), corrections, expansions
