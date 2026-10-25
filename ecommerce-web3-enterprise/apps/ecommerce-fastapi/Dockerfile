# Dockerfile (Docker + Python/Poetry) => multi-stage build. Contexto: raíz del monorepo
#   docker build -f apps/ecommerce-fastapi/Dockerfile --target production -t ecommerce-fastapi .
# Patrón Builder: cada stage tiene una sola responsabilidad (SRP); la imagen final no lleva herramientas de desarrollo.

# ---------- STAGE BASE: runtime de Python + Poetry ----------
# "FROM ... AS" => imagen base con nombre de stage | "slim" => Debian mínimo (menos superficie de ataque)
FROM python:3.12-slim AS base
# "ENV" => variables de entorno de la imagen
# PYTHONDONTWRITEBYTECODE => no genera .pyc | PYTHONUNBUFFERED => logs sin buffer (se ven al instante en docker logs)
# POETRY_VIRTUALENVS_CREATE=false => Poetry instala en el Python del contenedor (el contenedor ya es el aislamiento)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1
# "RUN" => ejecuta en build | "--no-cache-dir" => no guarda la cache de pip dentro de la imagen
RUN pip install --no-cache-dir "poetry>=2,<3"
# "WORKDIR" => carpeta de trabajo; uvicorn importa "app.main" relativo a ella
WORKDIR /app
# "COPY" => solo el manifiesto primero: la capa de dependencias se cachea mientras pyproject.toml no cambie
# "poetry.lock*" => opcional hasta que se genere con "poetry lock"
COPY apps/ecommerce-fastapi/pyproject.toml apps/ecommerce-fastapi/poetry.lock* ./

# ---------- STAGE DEVELOPMENT: usado por docker-compose.dev.yml (target: development) ----------
FROM base AS development
# "--no-root" => instala solo dependencias (package-mode = false) | incluye el grupo dev (pytest, ruff)
RUN poetry install --no-root
# Modelo de spaCy en español (02_FASTAPI_SETUP.md §2.9)
RUN python -m spacy download es_core_news_sm
COPY apps/ecommerce-fastapi ./
EXPOSE 8000
# "--reload" => reinicia al detectar cambios (bind mount del compose) | 0.0.0.0 => accesible desde fuera del contenedor
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---------- STAGE PRODUCTION ----------
FROM base AS production
# "--only main" => excluye el grupo dev (sin pytest/ruff en producción)
RUN poetry install --no-root --only main && python -m spacy download es_core_news_sm
COPY apps/ecommerce-fastapi/app ./app
COPY apps/ecommerce-fastapi/migrations ./migrations
COPY apps/ecommerce-fastapi/alembic.ini ./
# "useradd" + "USER" => proceso sin privilegios de root (mínimo privilegio)
RUN useradd --system --uid 10001 app
USER app
EXPOSE 8000
# "--workers" => procesos uvicorn en paralelo (aprovecha varios núcleos de CPU)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
