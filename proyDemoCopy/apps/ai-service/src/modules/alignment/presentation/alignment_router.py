"""Router del módulo Alignment (sincronización de texto y audio).

[Patrón]: Controller (MVC) + Thin Controller.
[Principio]: SRP — traduce HTTP (multipart) ↔ caso de uso.
[Paradigma]: Funcional + asíncrono.
[Seguridad]: JWT propagado por NestJS · tamaño máximo (ALIGNMENT_MAX_UPLOAD_MB) · el audio no se guarda.
[Sprint 9.4]: RF-119 (canciones: solo propone tiempos) y RF-124 (diálogos con voz limpia).
"""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import ValidationError

from src.modules.alignment.application.schemas.align_request import AlignRequest
from src.modules.alignment.application.schemas.align_response import AlignResponse
from src.modules.alignment.application.use_cases.align_lines import AlignLinesUseCase
from src.shared.clients.whisper_transcriber import WhisperTranscriber, get_speech_to_text
from src.shared.config.settings import get_settings
from src.shared.dependencies.auth_deps import CurrentUserDep
from src.shared.exceptions.custom_errors import ValidationDomainError

router = APIRouter(prefix="/alignment", tags=["alignment"])


@router.post("/align", summary="Inicio y fin de cada línea a partir del audio (multipart)")
async def align_lines(
    _user: CurrentUserDep,
    stt: Annotated[WhisperTranscriber, Depends(get_speech_to_text)],
    file: Annotated[UploadFile, File(description="Audio de la canción o del diálogo")],
    lines: Annotated[str, Form(description="Líneas en JSON: [\"Hello\", \"How are you?\"]")],
    language: Annotated[str, Form()],
    kind: Annotated[str, Form()] = "dialogue",
) -> AlignResponse:
    try:  # [Frontera]: multipart solo trae texto → se valida con el mismo schema que una petición JSON
        req = AlignRequest(lines=json.loads(lines), language=language, kind=kind)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise ValidationDomainError(f"Líneas o idioma no válidos: {exc}") from exc
    max_bytes = get_settings().alignment_max_upload_mb * 1024 * 1024
    audio = await file.read(max_bytes + 1)  # Lee como mucho el límite + 1 byte
    return await AlignLinesUseCase(stt, max_bytes).execute(audio, req)


@router.get("/health", summary="Sonda de salud del módulo")
async def health() -> dict[str, str]:
    return {"module": "alignment", "status": "ready"}
