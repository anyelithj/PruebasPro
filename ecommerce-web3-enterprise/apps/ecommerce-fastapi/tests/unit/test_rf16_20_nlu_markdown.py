# test_rf16_20_nlu_markdown.py (pytest) => pruebas de las funciones puras del lote RF 16–20:
# corrector + sinónimos (RF-17.9), entidades de chat (RF-17.2), métricas NLU (RF-17.12) y
# optimizador de rebajas (RF-18.10). Sin modelos ni base de datos (rápidas y deterministas).

from app.module.natural_language.ml import entity_extractor, nlu_metrics
from app.module.natural_language.ml.intent_detector import merge_examples
from app.module.natural_language.ml.query_normalizer import build_vocabulary, normalize_query
from app.module.price_optimization.ml import markdown_optimizer


def test_normalize_corrects_typos_and_expands_synonyms() -> None:
    vocabulary = build_vocabulary(["busco unos tenis negros", "estado de mi pedido"])
    text, corrections, expansions = normalize_query("busco tenis negors", vocabulary)
    assert text == "busco tenis negros"
    assert corrections == {"negors": "negros"}
    assert "zapatillas" in expansions


def test_entities_product_quantity_and_address() -> None:
    entities = entity_extractor.extract("quiero 2 camisetas negras, envíen a calle 10 # 5-20")
    labels = {e["label"]: e for e in entities}
    assert labels["QUANTITY"]["value"] == 2
    assert labels["PRODUCT"]["text"] == "camisetas negras"
    assert labels["ADDRESS"]["text"].lower().startswith("calle 10")


def test_merge_examples_adds_new_intents_without_duplicates() -> None:
    merged = merge_examples({"a": ["x"]}, {"a": ["x", "y"], "b": ["z"]})
    assert merged == {"a": ["x", "y"], "b": ["z"]}


def test_intent_and_entity_metrics() -> None:
    examples = [{"text": f"t{i}", "intent": "a" if i % 2 else "b"} for i in range(10)]
    _, test = nlu_metrics.split(examples)
    assert len(test) == 2
    result = nlu_metrics.intent_metrics(test, lambda text: ("a", 0.9))
    # Prueba = índices 4 ("b") y 9 ("a"): un clasificador que siempre dice "a" acierta la mitad
    assert result["accuracy"] == 0.5
    assert result["per_intent"]["a"]["recall"] == 1.0
    entity = nlu_metrics.entity_metrics(
        [{"text": "hola", "entities": [{"label": "X", "text": "hola"}]}],
        lambda text: [{"label": "X", "text": "hola"}],
    )
    assert entity["f1"] == 1.0


def test_markdown_prefers_clearing_stock_when_revenue_weighted() -> None:
    # Demanda elástica: a menor precio se vende más; 100 unidades, 10/semana a precio lleno
    def demand(multiplier: float) -> float:
        return 10 * multiplier**-2.5

    plan = markdown_optimizer.optimize(10_000, 100, 4, demand, 6_000, revenue_weight=1.0)
    assert plan.schedule == sorted(plan.schedule)  # Calendario no decreciente
    assert plan.schedule[-1] > 0  # Rebaja para liquidar
    no_markdown = markdown_optimizer.simulate((0, 0, 0, 0), 10_000, 100, demand, 6_000, 0.3)
    assert plan.revenue_cents >= int(no_markdown[1])
