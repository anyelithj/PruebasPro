# resnet_classifier.py (TensorFlow/Keras + ResNet-50) => clasificación top-k con pesos de ImageNet
# (transfer learning: modelo preentrenado, sin entrenar desde cero => cero costo de entrenamiento).
# Patrón: Strategy (clasificador intercambiable) + Singleton perezoso (el modelo se carga una vez,
# al primer uso). Paradigma: funcional (classify: array -> etiquetas).

from functools import lru_cache
from typing import Any

import numpy as np

from app.shared.constants.ml_constants import TOP_K_LABELS
from app.shared.util.model_cache import tensorflow_runtime


@lru_cache(maxsize=1)
def _model() -> Any:
    tf = tensorflow_runtime()
    # Pesos ImageNet (~100 MB): se descargan una sola vez a ~/.keras/models y luego se leen del
    # disco
    return tf.keras.applications.ResNet50(weights="imagenet")


# classify => pixels float32 (224, 224, 3) en 0-255 -> [{"label", "score"}] ordenadas por score
def classify(pixels: np.ndarray, k: int = TOP_K_LABELS) -> list[dict[str, Any]]:
    resnet = tensorflow_runtime().keras.applications.resnet50
    # "preprocess_input" => Normalize propio de ResNet-50 (RGB->BGR y resta de la media de ImageNet)
    # "[None]" => agrega la dimensión de lote: (1, 224, 224, 3)
    batch = resnet.preprocess_input(pixels[None].copy())
    # Llamada directa: sin overhead de predict()
    probabilities = _model()(batch, training=False).numpy()
    # decode_predictions => [(id, etiqueta, probabilidad), ...] de las k clases más probables
    return [
        {"label": label, "score": round(float(score), 4)}
        for _, label, score in resnet.decode_predictions(probabilities, top=k)[0]
    ]
