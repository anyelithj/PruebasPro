# visual_attributes.py (NumPy + CLIP) => RF-06.4 reconoce en una foto los COLORES dominantes, el
# PATRÓN (rayas, cuadros, flores...), la TEXTURA (denim, cuero, punto...) y la MARCA por su logo.
# - Colores: k-means propio sobre píxeles (NumPy, sin modelo ni dependencias) + nombre del color
#   más cercano de una paleta fija (distancia euclidiana en RGB).
# - Patrón, textura y marca: CLIP zero-shot (una frase por etiqueta; las marcas candidatas las
#   envía Express desde su catálogo). Patrón: Strategy (cada atributo con su técnica) + Facade
#   (extract). Paradigma: funcional (funciones puras array -> lista).

from typing import Any

import numpy as np

from app.module.image_recognition.ml import clip_embedder

# Paleta de nombres (es) -> RGB: suficiente para filtros de moda (no pretende ser exhaustiva)
PALETTE: dict[str, tuple[int, int, int]] = {
    "negro": (20, 20, 20),
    "blanco": (245, 245, 245),
    "gris": (128, 128, 128),
    "rojo": (200, 30, 40),
    "rosado": (240, 150, 180),
    "naranja": (240, 130, 30),
    "amarillo": (240, 210, 40),
    "verde": (40, 150, 60),
    "azul": (30, 70, 190),
    "azul claro": (120, 180, 230),
    "morado": (120, 50, 160),
    "café": (110, 70, 40),
    "beige": (220, 200, 160),
}
PATTERNS: tuple[str, ...] = (
    "liso",
    "rayas",
    "cuadros",
    "floral",
    "lunares",
    "animal print",
    "camuflado",
    "geométrico",
)
PATTERN_PROMPTS: tuple[str, ...] = (
    "a photo of a plain solid color product",
    "a photo of a product with stripes",
    "a photo of a product with a plaid checkered pattern",
    "a photo of a product with a floral print",
    "a photo of a product with polka dots",
    "a photo of a product with an animal print",
    "a photo of a product with a camouflage pattern",
    "a photo of a product with a geometric pattern",
)
TEXTURES: tuple[str, ...] = (
    "algodón",
    "denim",
    "cuero",
    "punto",
    "seda",
    "encaje",
    "gamuza",
    "lana",
    "plástico",
    "metal",
)
TEXTURE_PROMPTS: tuple[str, ...] = tuple(
    f"a close-up photo of {material}"
    for material in (
        "cotton fabric",
        "denim",
        "leather",
        "knitted fabric",
        "silk",
        "lace",
        "suede",
        "wool",
        "plastic",
        "metal",
    )
)
NO_BRAND = "a product without any visible logo"
TOP = 3  # Etiquetas devueltas por atributo
KMEANS_K, KMEANS_ITERATIONS, SAMPLE_SIDE = 5, 10, 64
MIN_COLOR_SHARE = 0.05  # Colores con menos del 5 % de la imagen se descartan (ruido, bordes)


# dominant_colors => k-means sobre una muestra de ~64x64 píxeles; devuelve los colores con su
# fracción de la imagen, fusionando los clusters que caen en el mismo nombre de la paleta
def dominant_colors(pixels: np.ndarray, k: int = KMEANS_K) -> list[dict[str, Any]]:
    step = max(1, pixels.shape[0] // SAMPLE_SIDE)
    sample = pixels[::step, ::step].reshape(-1, 3).astype(np.float32)
    rng = np.random.default_rng(0)  # Semilla fija => mismo resultado para la misma foto
    centers = sample[rng.choice(len(sample), size=min(k, len(sample)), replace=False)]
    nearest = np.zeros(len(sample), dtype=int)
    for _ in range(KMEANS_ITERATIONS):
        # Distancia de cada píxel a cada centro (broadcasting) -> índice del centro más cercano
        nearest = np.argmin(((sample[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2), axis=1)
        centers = np.array(
            [
                sample[nearest == i].mean(axis=0) if np.any(nearest == i) else centers[i]
                for i in range(len(centers))
            ]
        )
    names, rgb = list(PALETTE), np.array(list(PALETTE.values()), dtype=np.float32)
    shares: dict[str, float] = {}
    hexes: dict[str, str] = {}
    for i, center in enumerate(centers):
        name = names[int(np.argmin(((rgb - center) ** 2).sum(axis=1)))]
        shares[name] = shares.get(name, 0.0) + float(np.mean(nearest == i))
        hexes.setdefault(name, "#{:02x}{:02x}{:02x}".format(*(int(c) for c in center)))
    ranked = sorted(shares.items(), key=lambda item: -item[1])
    return [
        {"name": name, "hex": hexes[name], "share": round(share, 3)}
        for name, share in ranked
        if share >= MIN_COLOR_SHARE
    ]


def _top(results: list[tuple[str, float]]) -> list[dict[str, Any]]:
    return [{"label": label, "score": score} for label, score in results[:TOP]]


# extract => Facade: todos los atributos de una imagen ya preprocesada (pixels 224x224) y su
# embedding CLIP (se reutiliza el de la búsqueda: la imagen no vuelve a pasar por el modelo)
def extract(
    pixels: np.ndarray, image_vector: list[float], brands: tuple[str, ...] = ()
) -> dict[str, Any]:
    vector = np.asarray(image_vector, dtype=np.float32)
    patterns = clip_embedder.zero_shot(vector, clip_embedder.embed_texts(PATTERN_PROMPTS), PATTERNS)
    textures = clip_embedder.zero_shot(vector, clip_embedder.embed_texts(TEXTURE_PROMPTS), TEXTURES)
    detected_brands: list[dict[str, Any]] = []
    if brands:
        # "Sin logo" compite con las marcas: si gana, no se reporta ninguna (evita falsos positivos)
        labels = (*brands, "")
        prompts = (*(f"a product with the {brand} logo" for brand in brands), NO_BRAND)
        ranked = clip_embedder.zero_shot(vector, clip_embedder.embed_texts(prompts), labels)
        detected_brands = [item for item in _top(ranked) if item["label"]]
    return {
        "colors": dominant_colors(pixels),
        "patterns": _top(patterns),
        "textures": _top(textures),
        "brands": detected_brands,
    }
