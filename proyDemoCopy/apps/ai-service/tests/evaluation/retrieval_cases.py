"""Casos fijos de recuperación del RAG (Tarea 9 · RF-57): corpus PROPIO (redactado para el proyecto, sin texto de terceros) + consultas.

Lo usan la prueba `tests/unit/use_cases/assistant/test_rag_retrieval.py` y la métrica «recuperación@3» de `run_eval.py` (DRY).
[Patrón]: Test Fixture compartido + Table-Driven | [Paradigma]: Declarativo (datos) + funcional (`recall_at_k` es pura).
"""

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc, VectorStore


def _doc(rid: str, kind: str, level: str, topic: str, text: str) -> KnowledgeDoc:
    return KnowledgeDoc(rid, "en", level, kind, topic, f"[en {level} · {topic}] {text}", resource_id=rid, origin=f"{topic} (contenido propio)")


CORPUS: tuple[KnowledgeDoc, ...] = (
    _doc("articulos-a-an", "grammar_rule", "A1", "Articles",
         "Regla «Artículos a / an»: se usa «a» cuando la palabra siguiente empieza con sonido de consonante y «an» cuando empieza con sonido "
         "de vocal; cuenta el sonido, no la letra. Ejemplos: an apple = una manzana; an hour = una hora; a university = una universidad."),
    _doc("verbo-to-be", "grammar_rule", "A1", "Verb to be",
         "Regla «Verbo to be (ser / estar)»: en presente tiene tres formas: I am, you/we/they are, he/she/it is. Sirve para decir quién eres, "
         "de dónde eres y cómo estás. Ejemplos: I am Laura = Soy Laura; She is from Colombia = Ella es de Colombia; We are tired = Estamos cansados."),
    _doc("vocab-niece", "vocabulary", "A1", "Family",
         "niece: significa «sobrina», sustantivo. Ejemplos: My niece is five years old = Mi sobrina tiene cinco años."),
    _doc("frase-my-name-is", "example", "A1", "Introductions",
         "My name is Laura and I'm from Colombia = Me llamo Laura y soy de Colombia. Para decir tu nombre se usa «My name is»."),
    _doc("expresion-hands-to-myself", "translation", "B1", "Expressions",
         "Keep my hands to myself = No tocar / contenerme (expresión: no se traduce palabra por palabra; «Hands To Myself» como título "
         "se entiende como «No puedo contenerme»)."),
    _doc("vocab-kitchen", "vocabulary", "A1", "House",
         "kitchen: significa «cocina», sustantivo. Ejemplos: The kitchen is big = La cocina es grande."),
    _doc("presente-simple", "grammar_rule", "A2", "Present Simple",
         "Regla «Presente simple»: para hábitos y rutinas; con he/she/it el verbo lleva -s. Ejemplos: She works every day = Ella trabaja todos los días."),
)

# (consulta del estudiante, fragmento que debe estar entre los 3 primeros)
CASES: tuple[tuple[str, str], ...] = (
    ("¿Cuándo uso a o an? ¿se dice a apple?", "articulos-a-an"),
    ("no entendí el tema del verbo to be", "verbo-to-be"),
    ("my niece is Laura", "frase-my-name-is"),
    ("¿qué significa niece?", "vocab-niece"),
    ("Hands To Myself", "expresion-hands-to-myself"),
)


def recall_at_k(store: VectorStore, k: int = 3) -> float:
    """Parte de los casos cuyo fragmento esperado sale entre los `k` primeros (búsqueda híbrida, como el tutor). Función pura sobre el índice."""
    hits = 0
    for query, expected in CASES:
        found = [d.resource for d, _ in store.search_scored(query, k, "en", 0.0, hybrid=True)]
        hits += expected in found
    return hits / len(CASES)
