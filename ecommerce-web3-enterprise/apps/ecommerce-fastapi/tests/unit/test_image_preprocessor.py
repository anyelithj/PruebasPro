# test_image_preprocessor.py (pytest) => pipeline Resize -> CenterCrop -> Normalize y tipo Vector.

from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from app.module.image_recognition.ml.image_preprocessor import normalize, preprocess
from app.shared.util.feature_store import from_literal, to_literal


def png(width: int, height: int, mode: str = "RGBA") -> bytes:
    buffer = BytesIO()
    Image.new(mode, (width, height), color=(200, 30, 30, 255)[: len(mode)]).save(buffer, "PNG")
    return buffer.getvalue()


@pytest.mark.parametrize("size", [(640, 480), (300, 900), (224, 224)])
def test_preprocess_outputs_224_rgb_crop(size: tuple[int, int]) -> None:
    pixels = preprocess(png(*size))
    assert pixels.shape == (224, 224, 3) and pixels.dtype == np.float32
    assert pixels[0, 0].tolist() == [200.0, 30.0, 30.0]  # RGBA -> RGB sin perder el color


def test_preprocess_rejects_non_images() -> None:
    with pytest.raises(ValueError, match="no es una imagen"):
        preprocess(b"%PDF-1.7 no soy una imagen")


def test_normalize_per_channel() -> None:
    pixels = np.full((2, 2, 3), 255.0, dtype=np.float32)
    assert normalize(pixels, (0.5, 0.5, 0.5), (0.5, 0.5, 0.5))[0, 0].tolist() == [1.0, 1.0, 1.0]


def test_vector_literal_roundtrip() -> None:
    vector = [0.1, -0.25, 1.0]
    assert to_literal(vector) == "[0.100000,-0.250000,1.000000]"
    assert from_literal(to_literal(vector)) == vector
