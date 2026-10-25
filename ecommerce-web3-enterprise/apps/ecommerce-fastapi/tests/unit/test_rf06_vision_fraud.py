# test_rf06_vision_fraud.py (pytest) => funciones PURAS de RF-06.4 (colores dominantes, zero-shot),
# RF-06.6 (calidad de imagen) y RF-08.11 (reglas de fraude por dispositivo/IP/velocidad).
# Sin modelos ni base de datos: CLIP se reemplaza por vectores sintéticos.

import numpy as np
from PIL import Image, ImageFilter

from app.module.fraud_detection.ml.risk_scorer import rule_score
from app.module.image_recognition.ml.clip_embedder import zero_shot
from app.module.image_recognition.ml.image_quality import assess_quality
from app.module.image_recognition.ml.visual_attributes import dominant_colors


def test_dominant_colors_names_the_two_halves() -> None:
    pixels = np.zeros((224, 224, 3), dtype=np.float32)
    pixels[:, :112] = (200, 30, 40)  # Mitad roja
    pixels[:, 112:] = (30, 70, 190)  # Mitad azul
    colors = {color["name"]: color["share"] for color in dominant_colors(pixels)}
    assert set(colors) == {"rojo", "azul"}
    assert abs(colors["rojo"] - 0.5) < 0.05


def test_zero_shot_ranks_closest_prompt_first() -> None:
    texts = np.eye(3, dtype=np.float32)  # Tres "frases" ortogonales
    image = np.array([0.1, 0.9, 0.1], dtype=np.float32)
    ranked = zero_shot(image / np.linalg.norm(image), texts, ("a", "b", "c"))
    assert ranked[0][0] == "b"
    assert abs(sum(score for _, score in ranked) - 1) < 1e-3


def test_quality_flags_small_blurry_dark_image() -> None:
    noisy = Image.fromarray(
        np.random.default_rng(0).integers(0, 255, (800, 800, 3), dtype=np.uint8)
    )
    assert assess_quality(noisy)["issues"] == []  # Grande, con bordes y contraste
    bad = Image.new("RGB", (300, 300), (20, 20, 20)).filter(ImageFilter.GaussianBlur(4))
    report = assess_quality(bad)
    assert {"low_resolution", "blurry", "too_dark", "low_contrast"} <= set(report["issues"])
    assert report["score"] <= 20


def test_fraud_rules_device_ip_velocity() -> None:
    base = {
        "account_age_days": 300,
        "orders_last_24h": 0,
        "distinct_addresses_30d": 1,
        "payment_attempts": 1,
        "address_mismatch": 0,
        "email_verified": 1,
        "hour_of_day": 14,
    }
    assert rule_score(base) == (
        0.0,
        [],
    )  # Señales antiguas sin las nuevas claves: siguen funcionando
    score, triggered = rule_score(
        {**base, "accounts_on_device": 4, "ip_country_mismatch": 1, "checkouts_last_hour": 3}
    )
    assert set(triggered) == {"multi_account_device", "ip_geo_mismatch", "velocity_burst"}
    assert score == 0.55
