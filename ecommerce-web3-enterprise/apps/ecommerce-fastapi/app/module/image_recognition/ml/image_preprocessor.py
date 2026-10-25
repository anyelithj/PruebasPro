# image_preprocessor.py (Pillow + NumPy) => decodifica y prepara imágenes para ResNet-50 y CLIP.
# Pipeline: Decode -> RGB -> Resize (lado corto 256) -> CenterCrop 224 -> [Normalize por modelo].
# Patrón: Pipeline (pasos puros encadenados) + Strategy (cada modelo aplica su propia
# normalización). Paradigma: funcional (funciones puras: bytes -> array). Pillow + NumPy son más
# livianos que tf.image para una sola imagen y no necesitan cargar TensorFlow solo para recortar.

from io import BytesIO  # Envuelve los bytes subidos como archivo en memoria (sin tocar el disco)

import numpy as np
from PIL import Image, UnidentifiedImageError  # Pillow: decodificación de JPEG/PNG/WebP

from app.shared.constants.ml_constants import IMAGE_SIZE, RESIZE_SHORTER_SIDE


# decode => bytes -> imagen RGB. Lanza ValueError si no es una imagen válida (el service la traduce)
def decode(data: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(data))
        image.load()  # Fuerza la decodificación ahora: detecta archivos truncados o falsos
    # "(A, B)" => captura cualquiera de las dos excepciones
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("El archivo no es una imagen válida") from error
    # RGBA/escala de grises/CMYK -> 3 canales (lo que esperan los modelos)
    return image.convert("RGB")


# resize_center_crop => array float32 (224, 224, 3) en rango 0-255. Reducir primero el lado corto
# conserva la proporción; el recorte central descarta bordes (donde suele estar el fondo).
def resize_center_crop(image: Image.Image) -> np.ndarray:
    scale = RESIZE_SHORTER_SIDE / min(image.size)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)), Image.Resampling.BICUBIC
    )
    # "//" => división entera
    left, top = (resized.width - IMAGE_SIZE) // 2, (resized.height - IMAGE_SIZE) // 2
    cropped = resized.crop((left, top, left + IMAGE_SIZE, top + IMAGE_SIZE))
    return np.asarray(cropped, dtype=np.float32)


# preprocess => pipeline completo común a ambos modelos (la normalización la aplica cada modelo)
def preprocess(data: bytes) -> np.ndarray:
    return resize_center_crop(decode(data))


# normalize => (pixel / 255 - media) / desviación por canal. Broadcasting de NumPy: opera sobre las
# 224×224 posiciones de una vez, sin bucles
def normalize(pixels: np.ndarray, mean: tuple[float, ...], std: tuple[float, ...]) -> np.ndarray:
    return (pixels / 255.0 - np.array(mean, dtype=np.float32)) / np.array(std, dtype=np.float32)
