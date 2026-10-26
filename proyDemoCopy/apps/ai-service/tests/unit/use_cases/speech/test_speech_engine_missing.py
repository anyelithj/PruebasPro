"""Tests 2026-10-25: faster-whisper ausente → 503 SPEECH_ENGINE_MISSING (no MODEL_INFERENCE_ERROR), WARNING una sola vez y estado en /health.

[Patrón]: AAA + Test Double (`sys.modules[...] = None` simula «No module named 'faster_whisper'» sin desinstalar nada).
[Principio]: pruebas deterministas — sin red ni modelo.
"""

import logging
import sys

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app
from src.modules.speech.application.use_cases.transcribe_audio import TranscribeAudioUseCase
from src.shared.clients import whisper_transcriber as wt
from src.shared.dependencies.auth_deps import CurrentUser, get_current_user
from src.shared.exceptions.custom_errors import ModelInferenceError, SpeechEngineUnavailableError


@pytest.fixture
def missing_engine(monkeypatch: pytest.MonkeyPatch):
    # `sys.modules[name] = None` → `import name` lanza ImportError (igual que en un venv sin el paquete)
    monkeypatch.setitem(sys.modules, "faster_whisper", None)
    monkeypatch.setattr(wt, "_warned", False)
    wt._model.cache_clear()  # El modelo cacheado de otro test no debe ocultar la ausencia
    yield
    wt._model.cache_clear()


def test_estado_indica_motor_ausente_con_pista(missing_engine) -> None:
    st = wt.speech_engine_status()
    assert st.available is False and st.engine == "faster-whisper"
    assert "faster_whisper" in (st.reason or "")
    assert st.hint and "pip install -r requirements.txt" in st.hint


async def test_transcribir_sin_motor_es_error_propio_503(missing_engine) -> None:
    uc = TranscribeAudioUseCase(wt.WhisperTranscriber(), max_bytes=1024)
    with pytest.raises(SpeechEngineUnavailableError) as info:
        await uc.execute(b"audio", "en")
    err = info.value
    # Subclase de ModelInferenceError (mismo 503) pero con código distinguible
    assert isinstance(err, ModelInferenceError)
    assert err.status_code == 503 and err.code == "SPEECH_ENGINE_MISSING"
    assert "Instala faster-whisper" in err.message


async def test_warning_una_sola_vez(missing_engine, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.WARNING, logger="ai-service.speech")
    for _ in range(3):
        wt.speech_engine_status()
        with pytest.raises(SpeechEngineUnavailableError):
            await wt.WhisperTranscriber().transcribe(b"x", None)
    warnings = [r for r in caplog.records if r.name == "ai-service.speech"]
    assert len(warnings) == 1 and "NO disponible" in warnings[0].getMessage()


def test_fallo_al_cargar_el_modelo_no_es_audio_no_valido(monkeypatch: pytest.MonkeyPatch) -> None:
    # Motor presente pero el modelo no carga (p. ej. sin red en la primera descarga) → 503 MODEL_INFERENCE_ERROR, no 422
    def broken_model(*_a, **_k):
        raise OSError("sin conexión")

    monkeypatch.setattr(wt, "_import_whisper_model", lambda: broken_model)
    wt._model.cache_clear()
    try:
        with pytest.raises(ModelInferenceError) as info:
            wt._transcribe_sync(b"x", "en")
        assert info.value.code == "MODEL_INFERENCE_ERROR" and "sin conexión" in info.value.message
    finally:
        wt._model.cache_clear()


def test_compute_type_no_soportado_reintenta_con_default(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    def fake_model(_name: str, *, device: str, compute_type: str) -> str:
        calls.append(compute_type)
        if compute_type == "int8":
            raise ValueError("Requested int8 compute type, but the target device or backend do not support it")
        return f"model-{compute_type}"

    monkeypatch.setattr(wt, "_import_whisper_model", lambda: fake_model)
    monkeypatch.setattr(wt.get_settings(), "whisper_compute_type", "int8")
    wt._model.cache_clear()
    try:
        assert wt._model() == "model-default" and calls == ["int8", "default"]
    finally:
        wt._model.cache_clear()


async def _as_user() -> CurrentUser:
    return CurrentUser(id="u1", email="t@test.io", role="USER")


async def test_health_status_y_transcribe_http_sin_motor(missing_engine) -> None:
    app.dependency_overrides[get_current_user] = _as_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            health = await ac.get("/health")
            status = await ac.get("/api/v1/speech/status")
            r = await ac.post("/api/v1/speech/transcribe", files={"file": ("a.webm", b"audio", "audio/webm")})
    finally:
        app.dependency_overrides = {}
    assert health.status_code == 200 and health.json()["status"] == "ok"
    assert health.json()["speech"]["available"] is False
    assert status.json()["available"] is False and "pip install" in status.json()["hint"]
    assert r.status_code == 503 and r.json()["code"] == "SPEECH_ENGINE_MISSING"
