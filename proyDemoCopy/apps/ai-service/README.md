# AI Service (FastAPI)

Servicio de IA de AulaDeIdiomas: calificación, feedback, tutor (RAG), herramientas de idioma y **voz a texto** (faster-whisper).

## Arranque local

```bash
cd apps/ai-service
python -m venv .venv
# Linux/macOS: source .venv/bin/activate   ·   Windows (PowerShell): .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
python scripts/check_ai_deps.py          # comprueba faster-whisper / ctranslate2 / PyAV en ESTE venv
uvicorn src.main:app --reload --port 8000
```

- `GET /health` → `{"status": "ok", "speech": {"available": true|false, "reason", "hint", ...}}`
- `GET /api/v1/speech/status` → mismo estado del motor de voz (sin autenticación, no carga el modelo)

## Voz a texto (faster-whisper)

Lo usan *Temas de conversación*, *Biblioteca de diálogos* y los juegos orales (`POST /api/v1/speech/transcribe`).

| Situación | Respuesta | Qué hacer |
|---|---|---|
| `faster-whisper` no instalado o su DLL no carga | `503` `code: SPEECH_ENGINE_MISSING` + WARNING **una vez** en el arranque | `pip install -r requirements.txt` en el venv con el que se lanza `uvicorn` y reiniciar |
| El modelo no se descarga/carga, o la inferencia falla | `503` `code: MODEL_INFERENCE_ERROR` | Revisar conexión (primera descarga), RAM y el log |
| Audio corrupto o formato no soportado | `422` `code: VALIDATION_ERROR` | Volver a grabar |

Mientras el servidor no tenga voz a texto, el frontend usa el **dictado del navegador** (Web Speech API en Chrome/Edge) o
pide escribir la respuesta; la grabación del turno se sigue guardando en *Mis grabaciones*.

Variables (`.env`): `WHISPER_MODEL` (`tiny` ~75 MB · `base` ~145 MB, por defecto · `small` ~480 MB) y
`WHISPER_COMPUTE_TYPE` (`int8` por defecto).

### Windows

1. **Mismo venv**: el error `No module named 'faster_whisper'` casi siempre significa que `uvicorn` corre con otro
   Python. Usa `.venv\Scripts\python -m pip install -r requirements.txt` y `.venv\Scripts\python -m uvicorn src.main:app`.
   `python scripts/check_ai_deps.py` imprime qué intérprete se está usando.
2. **Versión de Python**: `faster-whisper` depende de `ctranslate2`, `av` (PyAV) y `onnxruntime`, que solo traen
   ruedas precompiladas para Windows **x64** y versiones de Python soportadas. Usa **Python 3.13 x64** (la misma
   versión que CI y Docker). Si pip responde `No matching distribution found for ctranslate2` (Python muy nuevo,
   Python de 32 bits o Windows ARM64), crea el venv con `py -3.13 -m venv .venv`.
3. **`ImportError: DLL load failed` al importar ctranslate2**: instala el *Microsoft Visual C++ Redistributable
   2015–2022 (x64)* y reinicia la terminal.
4. **`int8` en CPU**: CTranslate2 lo soporta en CPUs x64 con AVX2. Si la CPU no lo admite, el servicio registra un
   WARNING y reintenta automáticamente con `compute_type="default"` (float32). También puedes fijar
   `WHISPER_COMPUTE_TYPE=float32` en `.env`.
5. **Descarga del modelo**: la primera transcripción descarga el modelo de Hugging Face (necesita conexión) a
   `%USERPROFILE%\.cache\huggingface\hub`. Para moverlo (p. ej. otra unidad) define `HF_HOME`. El aviso de symlinks
   de Hugging Face en Windows es inofensivo; se silencia con `HF_HUB_DISABLE_SYMLINKS_WARNING=1` o activando el
   *Modo de desarrollador* de Windows.
6. Verifica: `curl http://localhost:8000/health` debe mostrar `"speech": {"available": true, ...}`.

## Tests

```bash
python -m pytest tests/unit -q          # los tests con faster-whisper/espeak reales se omiten si no están instalados
```
