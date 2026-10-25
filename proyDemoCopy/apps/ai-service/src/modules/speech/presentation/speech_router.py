"""Router del módulo Speech (voz a texto y fluidez para los juegos orales).

[Patrón]: Controller (MVC) + Thin Controller.
[Principio]: SRP — traduce HTTP (multipart) ↔ caso de uso.
[Paradigma]: Funcional + asíncrono.
[Seguridad]: JWT propagado por NestJS · tamaño máximo (SPEECH_MAX_UPLOAD_MB) · el audio no se guarda.
[Sprint 8.6]: RF-102, RF-104, RF-105.
"""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from src.modules.speech.application.schemas.fluency_request import FluencyRequest, FluencyResponse
from src.modules.speech.application.schemas.transcribe_response import TranscribeResponse
from src.modules.speech.application.use_cases.analyze_fluency import AnalyzeFluencyUseCase
from src.modules.speech.application.use_cases.transcribe_audio import TranscribeAudioUseCase
from src.shared.clients.whisper_transcriber import WhisperTranscriber, get_speech_to_text
from src.shared.config.settings import get_settings
from src.shared.dependencies.auth_deps import CurrentUserDep

router = APIRouter(prefix="/speech", tags=["speech"])


@router.post("/transcribe", summary="Transcribir una grabación (multipart) con marca de tiempo por palabra")
async def transcribe(
    _user: CurrentUserDep,
    stt: Annotated[WhisperTranscriber, Depends(get_speech_to_text)],
    file: Annotated[UploadFile, File(description="Audio webm/ogg/wav/mp3 (MediaRecorder)")],
    language: Annotated[str | None, Form(pattern=r"^(en|fr|de|es|pt|zh|ru)$")] = None,
) -> TranscribeResponse:
    max_bytes = get_settings().speech_max_upload_mb * 1024 * 1024
    audio = await file.read(max_bytes + 1)  # Lee como mucho el límite + 1 byte → no carga archivos enormes en memoria
    return await TranscribeAudioUseCase(stt, max_bytes).execute(audio, language)


@router.post("/fluency", summary="Métricas de fluidez a partir de las marcas de tiempo")
async def fluency(payload: FluencyRequest, _user: CurrentUserDep) -> FluencyResponse:
    return AnalyzeFluencyUseCase(get_settings().speech_pause_threshold_s).execute(payload)


@router.get("/models", summary="Modelos de voz instalados y su tamaño")
async def list_models(_user: CurrentUserDep) -> dict[str, object]:
    s = get_settings()
    # Caché de Hugging Face donde faster-whisper guarda los modelos descargados
    hub = Path.home() / ".cache" / "huggingface" / "hub"
    installed = [
        {"name": d.name.removeprefix("models--Systran--faster-whisper-"), "size_mb": round(sum(f.stat().st_size for f in d.rglob("*") if f.is_file()) / 1e6, 1)}
        for d in (hub.glob("models--Systran--faster-whisper-*") if hub.exists() else [])
    ]
    return {"active": s.whisper_model, "compute_type": s.whisper_compute_type, "installed": installed}
