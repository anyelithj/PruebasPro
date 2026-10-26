# syntax=docker/dockerfile:1.7
# [Imagen del ai-service · FastAPI]: build multi-etapa (compila dependencias → imagen final sin compiladores) | [Patrón]: Multi-stage Build | [Principio]: mínimo privilegio (usuario sin root) + Reproducibilidad (versiones fijadas)
# [Contexto]: apps/ai-service → docker build -t languageproject-ai-service apps/ai-service
# [Python 3.13]: misma versión que CI (.github/workflows/ci.yml · PYTHON_VERSION) | `slim-trixie`: Debian 13 sin extras (imagen base pequeña)

# ───────────── Etapa 1: dependencias ─────────────
FROM python:3.13.17-slim-trixie AS builder

# `PYTHONDONTWRITEBYTECODE`: sin .pyc en la capa · `PIP_DISABLE_PIP_VERSION_CHECK`: pip no consulta PyPI por versiones nuevas en cada comando
ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# [Compiladores]: psycopg2 (sin wheel) se compila contra libpq → build-essential + libpq-dev solo en esta etapa
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# [venv]: todas las dependencias en /opt/venv → la etapa final copia una sola carpeta
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# [pip fijado]: 26.2.2 dentro del venv (el resolvedor no cambia entre builds)
RUN pip install pip==26.2.2

# Requirements primero: Docker reutiliza la capa de dependencias si solo cambia el código
COPY requirements.txt ./
# `--mount=type=cache` (BuildKit): caché de descargas de pip entre builds sin guardarla en la imagen
# Índice CPU de PyTorch (igual que CI): torch==2.12.0 resuelve a la variante +cpu → evita ~2 GB de librerías CUDA
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# ───────────── Etapa 2: ejecución ─────────────
FROM python:3.13.17-slim-trixie AS runner

# `PYTHONUNBUFFERED`: logs al instante en `docker logs` · HF_HOME: caché de modelos de Hugging Face dentro de /app (escribible por el usuario «app»)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/venv/bin:$PATH" \
    HF_HOME=/app/.cache/huggingface \
    ENV=production

# [Librerías de sistema en runtime]: libpq5 (psycopg2) · espeak-ng (IPA y voz local, Sprint 4.7) · libgomp1 (OpenMP de faiss/torch/ctranslate2)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 espeak-ng libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# [Usuario sin privilegios]: UID fijo (10001) → permisos predecibles en volúmenes | [Seguridad]: el proceso no corre como root
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
# `--chown` (COPY): el código pertenece a «app» sin un chown -R aparte (capa más pequeña)
COPY --chown=app:app src ./src
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app training ./training
# [Datos]: índice FAISS, model card y caché de modelos (./data y HF_HOME) → carpetas del usuario «app» (montables como volumen)
RUN mkdir -p /app/data /app/.cache/huggingface && chown -R app:app /app/data /app/.cache
USER app

EXPOSE 8000

# [Healthcheck]: GET /health (endpoint de main.py) con la librería estándar → sin curl en la imagen | start-period largo: el warm-up carga torch y el modelo de embeddings
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=4).status == 200 else 1)"

# [uvicorn]: importa la instancia `app` de src/main.py (factoría create_app) · un worker (el modelo de embeddings ocupa RAM por proceso)
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
