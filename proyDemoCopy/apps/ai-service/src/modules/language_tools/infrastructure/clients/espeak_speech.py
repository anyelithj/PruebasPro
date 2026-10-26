"""Adaptador de voz con el binario espeak-ng (local, sin red ni LLM).

[Patrón]: Adapter (implementa SpeechSynthesizer).
[Principio]: SRP + DIP.
[Paradigma]: Asíncrono (`asyncio.to_thread` + subprocess bloqueante: funciona con cualquier event loop; en Windows uvicorn --reload usa SelectorEventLoop, que no soporta subprocesos asyncio).
[Seguridad]: el texto entra por stdin (`--stdin`), nunca como argumento → no puede interpretarse como opción ni como comando;
el archivo temporal lo crea `mkstemp` (nombre aleatorio, permisos 0600 del usuario actual) y se borra siempre.
"""

import asyncio
import os
import shutil
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path

from src.modules.language_tools.domain.interfaces.speech_synthesizer import (
    SpeechUnavailableError,
)
from src.shared.config.settings import get_settings

# [Ruta por defecto en Windows]: instalación de `winget install eSpeak-NG.eSpeak-NG`
_WINDOWS_DEFAULT = Path("C:/Program Files/eSpeak NG/espeak-ng.exe")
_TIMEOUT_S = (
    10  # Una palabra o frase corta tarda < 1 s; el límite evita procesos colgados
)


@lru_cache  # `lru_cache` (stdlib): la ruta se resuelve una sola vez por proceso · [Sprint 8.1]: pública → la reutiliza EspeakPhonetizer (DRY)
def espeak_binary() -> str | None:
    """ESPEAK_NG_PATH del entorno → PATH del sistema → ruta por defecto de Windows."""
    configured = get_settings().espeak_ng_path
    if configured:
        return configured
    return shutil.which("espeak-ng") or (
        str(_WINDOWS_DEFAULT) if _WINDOWS_DEFAULT.exists() else None
    )


# `-s 140` palabras/min (175 por defecto sonaba atropellado) · `-g 1` pausa corta entre palabras · `-p 45` tono algo más grave y natural
_VOICE_ARGS = ("-s", "140", "-g", "1", "-p", "45")


def _run_espeak(binary: str, text: str, voice: str) -> tuple[int, bytes, bytes]:
    """Ejecuta espeak-ng escribiendo el WAV en un ARCHIVO temporal (no en stdout) y devuelve (código, wav, stderr).

    [Por qué · 2026-10-24]: con `--stdout` espeak-ng no puede volver atrás en la tubería para escribir los tamaños reales y deja
    0x7FFFF000 en las cabeceras RIFF/data (≈ 2 GB anunciados para un audio de 200 KB); en Windows además la salida estándar de
    espeak-ng.exe no siempre está en modo binario. Resultado: decodificadores estrictos (Media Foundation, Safari) daban un audio mudo.
    Con `-w archivo` espeak-ng cierra el WAV con `fseek` y la cabecera queda correcta en todas las plataformas.
    """
    # `tempfile.mkstemp` (stdlib): crea y cierra el archivo → en Windows otro proceso (espeak-ng) puede abrirlo para escribir
    fd, path = tempfile.mkstemp(prefix="aula-tts-", suffix=".wav")
    os.close(fd)
    try:
        proc = subprocess.run(
            [binary, "-v", voice, *_VOICE_ARGS, "-w", path, "--stdin"],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=_TIMEOUT_S,
        )
        return proc.returncode, Path(path).read_bytes(), proc.stderr
    finally:
        # `missing_ok` (Python 3.8+): si espeak-ng falló antes de crear nada, no hay nada que borrar
        Path(path).unlink(missing_ok=True)


class EspeakSpeech:
    """Sintetiza WAV con espeak-ng."""

    # [2026-10-24]: «-v3» = WAV con cabecera correcta (archivo temporal en vez de stdout) → NestJS regenera los audios cacheados con la cabecera rota
    engine = "espeak-ng-v3"

    async def synthesize(self, text: str, voice: str) -> bytes:
        binary = espeak_binary()
        if binary is None:
            raise SpeechUnavailableError(
                "Motor de voz no disponible: instala espeak-ng o define ESPEAK_NG_PATH"
            )
        # `asyncio.to_thread`: el subproceso bloqueante corre en un hilo (sin shell → sin inyección; no bloquea el event loop)
        try:
            code, audio, stderr = await asyncio.to_thread(_run_espeak, binary, text, voice)
        except subprocess.TimeoutExpired as exc:
            raise SpeechUnavailableError(
                "El motor de voz no respondió a tiempo"
            ) from exc
        if code != 0 or not audio.startswith(b"RIFF"):  # RIFF = cabecera de un WAV válido
            raise SpeechUnavailableError(
                f"espeak-ng falló: {stderr.decode('utf-8', 'ignore')[:200]}"
            )
        return audio


def get_speech_synthesizer() -> EspeakSpeech:
    """Dependency de FastAPI (sin estado → una instancia por petición es gratis)."""
    return EspeakSpeech()
