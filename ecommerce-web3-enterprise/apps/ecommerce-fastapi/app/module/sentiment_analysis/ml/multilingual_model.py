# multilingual_model.py (KerasHub BERT multilingüe | Ollama granite-embedding) => codificadores de
# texto multilingües: texto -> vector con norma 1. Los usan sentimiento, intenciones de chat y de
# correos (DRY). Patrón: Strategy (dos codificadores intercambiables por config TEXT_ENCODER) +
# Singleton perezoso. Paradigma: funcional (Encoder = función list[str] -> np.ndarray).
# Ahorro de recursos: por defecto "ollama" (granite-embedding, XLM-RoBERTa multilingüe de 560 MB, el
# mismo modelo que usa el RAG); "bert" carga TensorFlow + BERT (~700 MB) solo si se elige.

from collections.abc import Callable
from functools import lru_cache
from typing import Any

import numpy as np

from app.config.llm_config import get_llm_settings
from app.module.natural_language.ml import llm_connector
from app.shared.util.model_cache import tensorflow_runtime

Encoder = Callable[[list[str]], np.ndarray]  # Alias de tipo: contrato común de los codificadores
BERT_PRESET = "bert_base_multi"  # BERT multilingüe (104 idiomas) de KerasHub


@lru_cache(maxsize=1)
def _bert() -> tuple[Any, Any]:
    tensorflow_runtime()
    import keras_hub  # Import diferido: solo si TEXT_ENCODER=bert

    return (
        keras_hub.models.BertTextClassifierPreprocessor.from_preset(
            BERT_PRESET, sequence_length=128
        ),
        keras_hub.models.BertBackbone.from_preset(BERT_PRESET),
    )


# bert_encoder => mean pooling de la última capa de BERT (promedio de los tokens reales, sin
# padding)
def bert_encoder(texts: list[str]) -> np.ndarray:
    preprocessor, backbone = _bert()
    inputs = preprocessor(texts)
    hidden = np.asarray(backbone(inputs)["sequence_output"])
    mask = np.asarray(inputs["padding_mask"], dtype=np.float32)[..., None]
    vectors = (hidden * mask).sum(axis=1) / mask.sum(axis=1)
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


# get_encoder => Factory: devuelve la estrategia configurada
def get_encoder() -> Encoder:
    return bert_encoder if get_llm_settings().TEXT_ENCODER == "bert" else llm_connector.embed
