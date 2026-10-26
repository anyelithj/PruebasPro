"""Comprueba las dependencias nativas del ai-service (voz a texto) en el venv ACTIVO.

Uso (desde apps/ai-service, con el venv activado):  python scripts/check_ai_deps.py
Sale con código 1 si falta alguna → sirve también en CI o antes de `uvicorn`.

[Patrón]: Health Check de línea de comandos | [Principio]: Fail Fast + SRP (solo diagnostica, no instala).
[2026-10-25]: nace del error «No module named 'faster_whisper'» en Windows (venv distinto al de requirements.txt).
"""

import importlib
import platform
import sys

# (módulo a importar, paquete de pip, para qué sirve) | `tuple` → inmutable
CHECKS: tuple[tuple[str, str, str], ...] = (
    ("faster_whisper", "faster-whisper", "voz a texto (Temas de conversación, Biblioteca de diálogos, juegos orales)"),
    ("ctranslate2", "ctranslate2", "motor de inferencia de faster-whisper (DLL nativa en Windows)"),
    ("av", "av", "decodifica webm/ogg/mp3 del navegador (PyAV)"),
)


def main() -> int:
    print(f"Python {platform.python_version()} ({platform.system()} {platform.machine()}) · {sys.executable}")
    missing = 0
    for module, package, purpose in CHECKS:
        try:
            mod = importlib.import_module(module)
            print(f"  OK     {package} {getattr(mod, '__version__', '')} — {purpose}")
        except ImportError as exc:  # Paquete ausente o DLL que no carga (Windows: falta el VC++ Redistributable)
            missing += 1
            print(f"  FALTA  {package} — {purpose}\n         {exc}")
    if missing:
        print("\nArreglo: pip install -r requirements.txt (en ESTE venv) y reinicia el ai-service. Ver README.md § Voz a texto.")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
