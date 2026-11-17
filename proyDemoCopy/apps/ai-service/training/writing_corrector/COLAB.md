# Entrenar `aula-corrector` en Google Colab (RF-144 · Tarea 6)

Para equipos sin GPU NVIDIA. Colab gratis ofrece una GPU **T4** (16 GB): suficiente para QLoRA de Qwen2.5-1.5B.
Tiempo aproximado: 10–20 min de entrenamiento + 10 min de exportación (con unos cientos de ejemplos).

> ⚠️ **Antes de entrenar: cantidad de datos.** Con 18 ejemplos (estado al 2026-11-14) el modelo solo memoriza.
> Hacen falta **varios cientos** de correcciones **revisadas por docentes** (errores frecuentes aprobados en el currículo
> o un JSONL `--extra` con redacciones corregidas). No se generan datos con IA para entrenar (RNF-37).

## 1. En tu equipo: preparar el dataset

```bash
cd apps/ai-service
python -m training.writing_corrector.prepare_dataset            # opcional: --extra revisadas.jsonl
```

Revisa el total que imprime (`train=N`). Sube a Colab estos 4 archivos:

- `data/own_llm/train.jsonl`
- `training/writing_corrector/train_qlora.py`
- `training/writing_corrector/export_gguf.py`
- `training/writing_corrector/Modelfile`

## 2. En Colab

**Entorno de ejecución → Cambiar tipo de entorno → GPU T4.** Luego una celda por bloque:

```python
# Celda 1 · subir los 4 archivos (botón «Elegir archivos»)
from google.colab import files
files.upload()
```

```bash
%%bash
# Celda 2 · dependencias de entrenamiento + estructura de carpetas que esperan los scripts
pip install -q "transformers>=4.46" "peft>=0.13" "trl>=0.12" bitsandbytes accelerate datasets
mkdir -p /content/ai/training/writing_corrector /content/ai/data/own_llm
touch /content/ai/training/__init__.py /content/ai/training/writing_corrector/__init__.py
mv /content/train_qlora.py /content/export_gguf.py /content/Modelfile /content/ai/training/writing_corrector/
mv /content/train.jsonl /content/ai/data/own_llm/
nvidia-smi --query-gpu=name,memory.total --format=csv
```

```bash
%%bash
# Celda 3 · entrenamiento QLoRA (en T4 usa float16 automáticamente)
cd /content/ai && python -m training.writing_corrector.train_qlora --epochs 3
```

```bash
%%bash
# Celda 4 · llama.cpp para convertir y cuantizar a GGUF
cd /content && git clone --depth 1 https://github.com/ggml-org/llama.cpp
pip install -q -r llama.cpp/requirements.txt
cmake -S llama.cpp -B llama.cpp/build -DGGML_CUDA=OFF && cmake --build llama.cpp/build --target llama-quantize -j 4
```

```bash
%%bash
# Celda 5 · fusionar el adaptador y exportar (sin Ollama: se registra en tu equipo)
cd /content/ai && python -m training.writing_corrector.export_gguf --llama-cpp /content/llama.cpp --version 1 --no-ollama
ls -lh training/writing_corrector/aula-corrector.gguf data/own_llm/export.txt
```

```python
# Celda 6 · descargar el modelo (~1 GB) y su ficha
from google.colab import files
files.download("/content/ai/training/writing_corrector/aula-corrector.gguf")
files.download("/content/ai/data/own_llm/export.txt")
```

Si la descarga directa se corta, copia los archivos a Google Drive (`from google.colab import drive; drive.mount('/content/drive')`).

## 3. De vuelta en tu equipo: registrar y evaluar

```bash
cd apps/ai-service
# Copia aula-corrector.gguf a training/writing_corrector/ y export.txt a data/own_llm/ (ambos fuera de git)
cd training/writing_corrector && ollama create aula-corrector -f Modelfile && cd ../..
python -m tests.evaluation.run_eval --compare aya-expanse:8b qwen2.5:3b mistral
```

`run_eval` compara `aula-corrector` con su modelo base y con Aya, Qwen y Mistral, y guarda el reporte en `data/eval/`.
**Regla de aceptación:** solo si `aula-corrector` no empeora ninguna métrica frente al modelo base (y la valoración docente
de naturalidad es ≥ 4 con `--teacher-scores notas.json`), RF-144 pasa a ✅ en la matriz. Si empeora, el servicio sigue
usando el modelo base (respaldo automático) y no se publica.
