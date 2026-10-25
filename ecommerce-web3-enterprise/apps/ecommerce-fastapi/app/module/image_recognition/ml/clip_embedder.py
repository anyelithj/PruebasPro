# clip_embedder.py (KerasHub + CLIP ViT-B/32) => embedding visual de 512 dimensiones normalizado
# (norma L2 = 1: la similitud coseno es un producto punto y pgvector compara vectores en la misma
# escala). Patrón: Strategy (embebedor intercambiable) + Adapter (expone list[float] sobre KerasHub)
# + Singleton perezoso (el backbone se carga una vez, al primer uso). Paradigma: funcional (embed:
# array -> vector).

from functools import lru_cache
from typing import Any

import numpy as np

from app.module.image_recognition.ml.image_preprocessor import normalize
from app.shared.util.model_cache import tensorflow_runtime

# ViT-B/32: el CLIP más liviano con embeddings de 512 dimensiones
CLIP_PRESET = "clip_vit_base_patch32"
# Media y desviación por canal con las que se entrenó CLIP (OpenAI)
CLIP_MEAN = (0.48145466, 0.4578275, 0.40821073)
CLIP_STD = (0.26862954, 0.26130258, 0.27577711)


@lru_cache(maxsize=1)
def _backbone() -> Any:
    tensorflow_runtime()  # Configura hilos antes de crear el modelo
    import keras_hub  # Import diferido: KerasHub arrastra TensorFlow

    # Pesos (~600 MB) descargados una sola vez a la caché de KerasHub
    return keras_hub.models.CLIPBackbone.from_preset(CLIP_PRESET)


# embed => pixels float32 (224, 224, 3) en 0-255 -> vector de 512 floats con norma 1
def embed(pixels: np.ndarray) -> list[float]:
    batch = normalize(pixels, CLIP_MEAN, CLIP_STD)[None]  # Normalize de CLIP + dimensión de lote
    vector = np.asarray(_backbone().get_vision_embeddings(batch))[0]
    # "np.linalg.norm" => longitud euclidiana (L2)
    return (vector / np.linalg.norm(vector)).tolist()


# _preprocessor => tokenizador BPE de CLIP del mismo preset: convierte frases en token_ids
@lru_cache(maxsize=1)
def _preprocessor() -> Any:
    tensorflow_runtime()
    import keras_hub

    return keras_hub.models.CLIPPreprocessor.from_preset(CLIP_PRESET)


# embed_texts => RF-06.4/06.6 embeddings de texto normalizados (una fila por frase). "lru_cache" =>
# las listas fijas de etiquetas (patrones, texturas, moderación) se embeben UNA vez por proceso; por
# eso recibe una tupla (hashable) y no una lista
@lru_cache(maxsize=64)
def embed_texts(prompts: tuple[str, ...]) -> np.ndarray:
    token_ids = _preprocessor()({"images": None, "prompts": list(prompts)})["token_ids"]
    vectors = np.asarray(_backbone().get_text_embeddings(token_ids))
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


# CLIP_LOGIT_SCALE => temperatura con la que se entrenó CLIP (exp(4.6052) ≈ 100): convierte
# similitudes coseno en probabilidades bien separadas con softmax
CLIP_LOGIT_SCALE = 100.0


# zero_shot => clasificación "sin entrenamiento": compara la imagen con una frase por etiqueta y
# devuelve [(etiqueta, probabilidad)] de mayor a menor. Función pura sobre vectores (testeable)
def zero_shot(
    image_vector: np.ndarray, text_vectors: np.ndarray, labels: tuple[str, ...]
) -> list[tuple[str, float]]:
    logits = CLIP_LOGIT_SCALE * (text_vectors @ image_vector)
    probabilities = np.exp(logits - logits.max())  # Softmax numéricamente estable
    probabilities /= probabilities.sum()
    order = np.argsort(-probabilities)
    return [(labels[i], round(float(probabilities[i]), 4)) for i in order]
