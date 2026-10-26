"""Adaptador del fonetizador con el binario espeak-ng (local, sin red ni LLM).

[Patrón]: Adapter (implementa Phonetizer) + Batch (un proceso para N palabras) + LRU Cache + Bulkhead (máx. procesos simultáneos).
[Principio]: SRP + DIP + DRY (reutiliza la ruta del binario de EspeakSpeech) + Fail Soft (una palabra mala → IPA vacío, no 503).
[Paradigma]: Asíncrono (`asyncio.to_thread` + subprocess bloqueante: funciona con cualquier event loop en Windows).
[Seguridad]: el texto entra por stdin, nunca como argumento → no puede interpretarse como opción ni como comando.
[Versión fija · Sprint 8.1]: `ESPEAK_NG_VERSION` se compara con `espeak-ng --version`; otra versión cambia la salida IPA.
[2026-10-24 · IPA de francés lenta y con 503]: espeak-ng parte la salida en una línea por CLÁUSULA (comas, «?», «—»…) → el lote dejaba de
alinearse y se transcribía palabra a palabra EN SERIE (un proceso por palabra: 12–16 s en Windows) y una sola palabra con timeout → 503.
Ahora: los signos internos se neutralizan antes del lote (una línea de salida por elemento), el respaldo es concurrente y acotado,
las transcripciones se memorizan (LRU) y un fallo puntual devuelve "" para esa palabra.
"""

import asyncio
import os
import re
import subprocess
import threading
from collections import OrderedDict
from functools import lru_cache

from src.modules.language_tools.domain.interfaces.phonetizer import PhonetizerMissingError
from src.modules.language_tools.domain.interfaces.speech_synthesizer import SpeechUnavailableError
from src.modules.language_tools.infrastructure.clients.espeak_speech import espeak_binary

ESPEAK_NG_VERSION = "1.52"  # Versión validada (winget eSpeak-NG.eSpeak-NG / apt espeak-ng 1.52)
_TIMEOUT_S = 10
# [Bulkhead]: tope de procesos espeak-ng simultáneos (equipos con poca RAM/CPU) | `threading.BoundedSemaphore`: vale para cualquier event loop porque se usa dentro del hilo
_MAX_PROCS = max(2, min(4, os.cpu_count() or 2))
_PROC_SLOTS = threading.BoundedSemaphore(_MAX_PROCS)
# [Signos que abren una cláusula nueva en espeak-ng]: se cambian por espacio en el lote → una línea de salida por elemento (los apóstrofos y guiones de «aujourd'hui» o «peut-être» se conservan)
_CLAUSE_MARKS = re.compile(r"[.,;:!?¡¿…«»\"“”()\[\]{}—–]+")
# [Cambio de idioma]: espeak-ng marca préstamos con «(en)wˈiːkɛnd(fr)» → no son símbolos IPA
_LANG_SWITCH = re.compile(r"\([a-z]{2,3}(?:-[a-z0-9]+)?\)")
_HAS_LETTER = re.compile(r"[^\W\d_]|\d")  # `[^\W\d_]` (re): cualquier letra Unicode; los números también se leen


class _LruCache:
    """Caché LRU acotada (voz, texto) → IPA | `OrderedDict.move_to_end` (stdlib): O(1) para marcar uso reciente | [Patrón]: Memoization."""

    def __init__(self, maxsize: int = 20_000) -> None:
        self._data: OrderedDict[tuple[str, str], str] = OrderedDict()
        self._max = maxsize
        self._lock = threading.Lock()  # `threading.Lock`: lecturas/escrituras atómicas aunque se llame desde hilos

    def get(self, key: tuple[str, str]) -> str | None:
        with self._lock:
            if key not in self._data:
                return None
            self._data.move_to_end(key)
            return self._data[key]

    def put(self, key: tuple[str, str], value: str) -> None:
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            if len(self._data) > self._max:
                self._data.popitem(last=False)  # `last=False`: expulsa el menos usado

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


_CACHE = _LruCache()


def _run(args: list[str], text: str) -> str:
    """Ejecuta espeak-ng con el texto por stdin y devuelve stdout (UTF-8). [Paradigma]: función bloqueante → se llama en un hilo."""
    binary = espeak_binary()
    if binary is None:
        raise PhonetizerMissingError("Fonetizador no disponible: instala espeak-ng o define ESPEAK_NG_PATH")
    with _PROC_SLOTS:  # `with` (Python): libera el cupo aunque el proceso falle
        try:
            proc = subprocess.run([binary, *args], input=text.encode("utf-8"), capture_output=True, timeout=_TIMEOUT_S)
        except subprocess.TimeoutExpired as exc:
            raise SpeechUnavailableError("El fonetizador no respondió a tiempo") from exc
    if proc.returncode != 0:
        raise SpeechUnavailableError(f"espeak-ng falló: {proc.stderr.decode('utf-8', 'ignore')[:200]}")
    return proc.stdout.decode("utf-8", "ignore")


def _clean_ipa(raw: str) -> str:
    """Una línea, sin marcas de cambio de idioma y con espacios normalizados. [Paradigma]: función pura."""
    return " ".join(_LANG_SWITCH.sub("", raw).split())


def _batch_item(text: str) -> str:
    """Elemento listo para el lote: sin signos de cláusula internos (una sola línea de salida). [Paradigma]: función pura."""
    return " ".join(_CLAUSE_MARKS.sub(" ", text).split())


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
        key = (voice, text.strip())
        cached = _CACHE.get(key)
        if cached is not None:
            return cached
        # [Salto final]: sin él espeak-ng corta la última sílaba («umbrella» → «ˈʌmbɹəl» en vez de «ʌmbɹˈɛlə»)
        out = _clean_ipa(await asyncio.to_thread(_run, ["-q", "--ipa", "-v", voice, "--stdin"], key[1] + "\n"))
        _CACHE.put(key, out)
        return out

    async def ipa_words(self, words: list[str], voice: str) -> list[str]:
        """IPA de cada elemento en orden; un elemento que falla queda en "" (resultado parcial, nunca 503 por una palabra)."""
        result: list[str | None] = [_CACHE.get((voice, w.strip())) for w in words]
        # Pendientes: no están en caché y tienen algo pronunciable (un «—» suelto no produce IPA → "")
        pending = [i for i, (w, r) in enumerate(zip(words, result, strict=True)) if r is None and _HAS_LETTER.search(w)]
        pending_set = set(pending)  # `set` (Python): pertenencia O(1)
        for i in range(len(words)):
            if result[i] is None and i not in pending_set:
                result[i] = ""
        if pending:
            items = [_batch_item(words[i]) for i in pending]
            lines = await self._batch(items, voice)
            if lines is not None and len(lines) == len(pending):
                for i, ipa in zip(pending, lines, strict=True):
                    result[i] = ipa
                    _CACHE.put((voice, words[i].strip()), ipa)
            else:
                # [Respaldo concurrente y acotado]: alineación rota o lote fallido → cada elemento por separado (el semáforo limita los procesos)
                singles = await asyncio.gather(*(self._safe_ipa(words[i], voice) for i in pending))
                for i, ipa in zip(pending, singles, strict=True):
                    result[i] = ipa
        return [r or "" for r in result]

    async def _batch(self, items: list[str], voice: str) -> list[str] | None:
        """Un proceso para todo el lote: «elemento.» por línea → una línea de IPA por elemento | None si el lote falla (salvo binario ausente)."""
        try:
            out = await asyncio.to_thread(_run, ["-q", "--ipa", "-v", voice, "--stdin"], "".join(f"{w}.\n" for w in items))
        except PhonetizerMissingError:
            raise  # Sin espeak-ng no hay respaldo posible → 503 legítimo
        except SpeechUnavailableError:
            return None
        return [_clean_ipa(ln) for ln in out.splitlines() if ln.strip()]

    async def _safe_ipa(self, word: str, voice: str) -> str:
        """IPA de un elemento; "" si ese elemento concreto falla (timeout, salida rara) | [Patrón]: Null Object por palabra."""
        try:
            return await self.ipa(word, voice)
        except PhonetizerMissingError:
            raise
        except SpeechUnavailableError:
            return ""


def get_phonetizer() -> EspeakPhonetizer:
    """Dependency de FastAPI (sin estado propio: la caché LRU es del módulo y se comparte entre peticiones)."""
    return EspeakPhonetizer()
