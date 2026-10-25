"""Adaptador del fonetizador con el binario espeak-ng (local, sin red ni LLM).

[Patrón]: Adapter (implementa Phonetizer).
[Principio]: SRP + DIP + DRY (reutiliza la ruta del binario de EspeakSpeech).
[Paradigma]: Asíncrono (`asyncio.to_thread` + subprocess bloqueante: funciona con cualquier event loop en Windows).
[Seguridad]: el texto entra por stdin, nunca como argumento → no puede interpretarse como opción ni como comando.
[Versión fija · Sprint 8.1]: `ESPEAK_NG_VERSION` se compara con `espeak-ng --version`; otra versión cambia la salida IPA.
"""

import asyncio
import re
import subprocess
from functools import lru_cache

from src.modules.language_tools.domain.interfaces.speech_synthesizer import SpeechUnavailableError
from src.modules.language_tools.infrastructure.clients.espeak_speech import espeak_binary

ESPEAK_NG_VERSION = "1.52"  # Versión validada (winget eSpeak-NG.eSpeak-NG / apt espeak-ng 1.52)
_TIMEOUT_S = 10


def _run(args: list[str], text: str) -> str:
    """Ejecuta espeak-ng con el texto por stdin y devuelve stdout (UTF-8). [Paradigma]: función bloqueante → se llama en un hilo."""
    binary = espeak_binary()
    if binary is None:
        raise SpeechUnavailableError("Fonetizador no disponible: instala espeak-ng o define ESPEAK_NG_PATH")
    try:
        proc = subprocess.run([binary, *args], input=text.encode("utf-8"), capture_output=True, timeout=_TIMEOUT_S)
    except subprocess.TimeoutExpired as exc:
        raise SpeechUnavailableError("El fonetizador no respondió a tiempo") from exc
    if proc.returncode != 0:
        raise SpeechUnavailableError(f"espeak-ng falló: {proc.stderr.decode('utf-8', 'ignore')[:200]}")
    return proc.stdout.decode("utf-8", "ignore")


@lru_cache  # Una sola consulta de versión por proceso
def _engine() -> str:
    try:
        match = re.search(r"\d+\.\d+(\.\d+)?", _run(["--version"], ""))  # «eSpeak NG text-to-speech: 1.52.0  Data at: …»
        version = match.group(0) if match else "desconocida"
    except SpeechUnavailableError:
        version = "no instalado"
    return f"espeak-ng {version}"


class EspeakPhonetizer:
    """IPA con `espeak-ng -q --ipa` (-q: sin audio)."""

    @property
    def engine(self) -> str:
        return _engine()

    async def ipa(self, text: str, voice: str) -> str:
        # [Salto final]: sin él espeak-ng corta la última sílaba («umbrella» → «ˈʌmbɹəl» en vez de «ʌmbɹˈɛlə»)
        out = await asyncio.to_thread(_run, ["-q", "--ipa", "-v", voice, "--stdin"], text.strip() + "\n")
        return " ".join(out.split())  # Una línea, espacios normalizados

    async def ipa_words(self, words: list[str], voice: str) -> list[str]:
        if not words:
            return []
        # [Truco]: «palabra.» por línea → espeak-ng cierra la cláusula y devuelve UNA línea de IPA por palabra (un solo proceso)
        out = await asyncio.to_thread(_run, ["-q", "--ipa", "-v", voice, "--stdin"], "".join(f"{w}.\n" for w in words))
        lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
        if len(lines) == len(words):
            return lines
        # [Respaldo]: si la puntuación de una palabra rompió la alineación, se transcribe palabra a palabra
        return [await self.ipa(w, voice) for w in words]


def get_phonetizer() -> EspeakPhonetizer:
    """Dependency de FastAPI (sin estado)."""
    return EspeakPhonetizer()
