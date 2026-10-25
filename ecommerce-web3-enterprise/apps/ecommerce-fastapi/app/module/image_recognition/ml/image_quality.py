# image_quality.py (Pillow + NumPy + CLIP) => RF-06.6 calidad de la foto de producto y detección
# de contenido inapropiado ANTES de publicarla.
# - Calidad: resolución, nitidez (varianza del Laplaciano: foto movida o desenfocada = poca
#   varianza), brillo y contraste => puntaje 0-100 + lista de problemas. Solo NumPy (sin modelo).
# - Moderación: CLIP zero-shot contra categorías no aptas (desnudez, violencia, armas, drogas, odio)
#   vs. "foto de producto segura". Patrón: Strategy (dos inspecciones independientes).
#   Paradigma: funcional (funciones puras).

from typing import Any

import numpy as np
from PIL import Image

from app.module.image_recognition.ml import clip_embedder

MIN_SIDE = 600  # Lado mínimo recomendado para el zoom de la ficha de producto
BLUR_THRESHOLD = 60.0  # Varianza del Laplaciano por debajo => borrosa (calibrable)
DARK, BRIGHT = 50.0, 215.0  # Brillo medio (0-255) fuera de este rango => sub/sobreexpuesta
LOW_CONTRAST = 25.0  # Desviación estándar del gris por debajo => imagen plana o lavada
ANALYSIS_SIDE = 512  # Se analiza una copia reducida (rápido y comparable entre tamaños)
ISSUE_PENALTY = 20  # Puntos que resta cada problema (5 problemas posibles => mínimo 0)
MODERATION_LABELS: tuple[str, ...] = ("safe", "nudity", "violence", "weapon", "drugs", "hate")
MODERATION_PROMPTS: tuple[str, ...] = (
    "a safe product photo for an online store",
    "a photo containing nudity or sexual content",
    "a violent or gory photo with blood",
    "a photo of a gun or weapon",
    "a photo of illegal drugs",
    "a photo with an offensive hate symbol",
)
FLAG_THRESHOLD = 0.6  # Probabilidad mínima de una categoría no apta para bloquear la imagen


# laplacian_variance => nitidez: el Laplaciano resalta los bordes; una foto nítida tiene bordes
# fuertes (alta varianza). Convolución 3x3 con slicing de NumPy (sin SciPy ni OpenCV)
def laplacian_variance(gray: np.ndarray) -> float:
    center = gray[1:-1, 1:-1]
    lap = gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:] - 4 * center
    return float(lap.var())


# assess_quality => {score, width, height, sharpness, brightness, contrast, issues}
def assess_quality(image: Image.Image) -> dict[str, Any]:
    width, height = image.size
    small = image.copy()
    small.thumbnail((ANALYSIS_SIDE, ANALYSIS_SIDE))  # Reduce conservando la proporción
    gray = np.asarray(small.convert("L"), dtype=np.float32)
    sharpness, brightness, contrast = (
        laplacian_variance(gray),
        float(gray.mean()),
        float(gray.std()),
    )
    checks = (
        ("low_resolution", min(width, height) < MIN_SIDE),
        ("blurry", sharpness < BLUR_THRESHOLD),
        ("too_dark", brightness < DARK),
        ("too_bright", brightness > BRIGHT),
        ("low_contrast", contrast < LOW_CONTRAST),
    )
    issues = [name for name, failed in checks if failed]
    return {
        "score": 100 - ISSUE_PENALTY * len(issues),
        "width": width,
        "height": height,
        "sharpness": round(sharpness, 1),
        "brightness": round(brightness, 1),
        "contrast": round(contrast, 1),
        "issues": issues,
    }


# moderate => {flagged, category, scores}: "flagged" si una categoría no apta supera el umbral
def moderate(image_vector: list[float]) -> dict[str, Any]:
    vector = np.asarray(image_vector, dtype=np.float32)
    results = clip_embedder.zero_shot(
        vector, clip_embedder.embed_texts(MODERATION_PROMPTS), MODERATION_LABELS
    )
    top_label, top_score = results[0]
    flagged = top_label != "safe" and top_score >= FLAG_THRESHOLD
    return {"flagged": flagged, "category": top_label if flagged else None, "scores": dict(results)}
