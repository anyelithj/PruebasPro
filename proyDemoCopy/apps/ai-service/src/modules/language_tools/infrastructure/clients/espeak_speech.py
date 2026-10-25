"""Adaptador de voz con el binario espeak-ng (local, sin red ni LLM).

[Patrón]: Adapter (implementa SpeechSynthesizer).
[Principio]: SRP + DIP.
[Paradigma]: Asíncrono (`asyncio.to_thread` + subprocess bloqueante: funciona con cualquier event loop; en Windows uvicorn --reload usa SelectorEventLoop, que no soporta subprocesos asyncio).
[Seguridad]: el texto entra por stdin (`--stdin`), nunca como argumento → no puede interpretarse como opción ni como comando.
"""

import asyncio
import shutil
import subprocess
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


class EspeakSpeech:
    """Sintetiza WAV con espeak-ng."""

    # [2026-10-20]: «-v2» = parámetros nuevos (velocidad/entonación) → NestJS genera audios nuevos en vez de reutilizar los robóticos cacheados
    engine = "espeak-ng-v2"

    async def synthesize(self, text: str, voice: str) -> bytes:
        binary = espeak_binary()
        if binary is None:
            raise SpeechUnavailableError(
                "Motor de voz no disponible: instala espeak-ng o define ESPEAK_NG_PATH"
            )
        # `subprocess.run` en un hilo (`asyncio.to_thread`): sin shell → sin inyección; no bloquea el event loop
        try:
            proc = await asyncio.to_thread(
                subprocess.run,
                # `-s 140` palabras/min (175 por defecto sonaba atropellado) · `-g 1` pausa corta entre palabras · `-p 45` tono algo más grave y natural
                [binary, "-v", voice, "-s", "140", "-g", "1", "-p", "45", "--stdin", "--stdout"],
                input=text.encode("utf-8"),
                capture_output=True,
                timeout=_TIMEOUT_S,
            )
        except subprocess.TimeoutExpired as exc:
            raise SpeechUnavailableError(
                "El motor de voz no respondió a tiempo"
            ) from exc
        audio = proc.stdout
        if proc.returncode != 0 or not audio.startswith(
            b"RIFF"
        ):  # RIFF = cabecera de un WAV válido
            raise SpeechUnavailableError(
                f"espeak-ng falló: {proc.stderr.decode('utf-8', 'ignore')[:200]}"
            )
        return audio


def get_speech_synthesizer() -> EspeakSpeech:
    """Dependency de FastAPI (sin estado → una instancia por petición es gratis)."""
    return EspeakSpeech()
