# Comandos Generales — Portfolio (FastAPI · NestJS · Nuxt)

Puertos (host):

| Servicio | Puerto | Postgres (dev) | Redis (dev) |
|----------|--------|----------------|-------------|
| FastAPI  | 8000   | 5434           | 6381        |
| NestJS   | 3000   | 5433           | 6380        |
| Frontend (Nuxt) | 3001 | — | — |

> El Redis de FastAPI usa **6381** en el host: el 6379 lo ocupa el redis de otro
> proyecto tuyo (`neuro-redis`, de proydemo).

> Nuxt por defecto usa 3000 → **choca con Nest**. Arráncalo en **3001**.

---

## 0. Requisitos

- Docker Desktop (para DB/Redis)
- Python 3.12+ y Poetry (o el `.venv` ya creado) para FastAPI
- Node 22+ para NestJS y Nuxt

---

## 1. Bases de datos + Redis (Docker)

Cada backend trae su propio compose de infra (Postgres + Redis aislados).

```bash
# FastAPI: postgres:5432 + redis:6379
cd fastapi-backend
docker compose -f docker-compose.dev.yml up -d

# NestJS: postgres:5433 + redis:6380
cd ../nest-backend
docker compose -f docker-compose.dev.yml up -d
```

Verificar / apagar:

```bash
docker compose -f docker-compose.dev.yml ps       # estado
docker compose -f docker-compose.dev.yml down     # apagar (conserva datos)
docker compose -f docker-compose.dev.yml down -v  # apagar + borrar datos
```

---

## 2. FastAPI (:8000)

```bash


cp .env.example .env                 # ajusta JWT_SECRET (primera vez)

# dependencias (una vez). Con el .venv ya creado, sáltalo.
python -m venv .venv
.venv/Scripts/python.exe -m pip install fastapi uvicorn "sqlalchemy[asyncio]" asyncpg \
  alembic pydantic pydantic-settings pyjwt argon2-cffi redis email-validator python-multipart
# o con Poetry:  poetry install

# migraciones (necesita Postgres arriba)
.venv/Scripts/python.exe -m alembic revision --autogenerate -m "init"   # primera vez
.venv/Scripts/python.exe -m alembic upgrade head

# arrancar API con reload
.venv/Scripts/python.exe -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Docs: http://localhost:8000/docs · Health: http://localhost:8000/health

Tests:

```bash
JWT_SECRET=test-secret .venv/Scripts/python.exe -m pytest -q
```

---

## 3. NestJS (:3000)

```bash
cd nest-backend
cp .env.example .env                 # ajusta JWT_SECRET y JWT_REFRESH_SECRET (primera vez)

npm install                          # una vez
npx prisma generate                  # una vez / tras cambiar schema.prisma

# migraciones (necesita Postgres:5433 arriba)
npx prisma migrate dev --name init   # primera vez (crea tablas)
# npx prisma migrate deploy          # en prod/CI

npm run prisma:seed                  # opcional: admin@portfolio.dev / admin12345

npm run start:dev                    # arranca con watch
```

Health: http://localhost:3000/health

Tests:

```bash
npm test           # unit (sin DB)
npm run test:e2e   # integración (necesita Postgres)
```

---

## 4. Frontend Nuxt (:3001)

```bash
cd Frontend
cp .env.example .env                 # elige NUXT_PUBLIC_API_PROVIDER=nest|fastapi

npm install                          # una vez

npm run dev                          # dev en 3001 (puerto fijado en package.json)
```

Rutas útiles:
- http://localhost:3001/api-status  → estado de ambos backends
- http://localhost:3001/login       → login/registro (toggle Nest ⇄ FastAPI)
- http://localhost:3001/account     → ruta protegida (GET /users/me)

Typecheck / build:

```bash
npx nuxi typecheck
npm run build && npm run preview
```

---

## 5. Levantar TODO (orden recomendado)

```bash
# 1) Infra de ambos backends
cd fastapi-backend && docker compose -f docker-compose.dev.yml up -d && cd ..
cd nest-backend    && docker compose -f docker-compose.dev.yml up -d && cd ..

# 2) Migraciones (una vez)
cd fastapi-backend && .venv/Scripts/python.exe -m alembic upgrade head && cd ..
cd nest-backend    && npx prisma migrate dev --name init && cd ..

# 3) Backends (cada uno en su terminal)
cd fastapi-backend && .venv/Scripts/python.exe -m uvicorn src.main:app --reload --port 8000
cd nest-backend    && npm run start:dev

# 4) Frontend (otra terminal)
cd Frontend && npm run dev
```

---

## 6. Alternativa: stack completo en Docker (sin correr local)

Cada backend tiene un `docker-compose.yml` que levanta API + Postgres + Redis y
corre migraciones al arrancar:

```bash
cd fastapi-backend && docker compose up --build     # API :8000
cd nest-backend    && docker compose up --build     # API :3000
```

---

## 7. Arranque diario (al encender el PC)

Orden: **1) Docker → 2) FastAPI → 3) NestJS → 4) Nuxt**. Cada servicio en su
propia terminal. Ejecutar desde la raíz del proyecto (`my-portfolio-web`).

> Requisito previo: Docker Desktop abierto y corriendo.

**Paso 1 — Docker (Postgres + Redis de ambos backends)**

```bash
cd fastapi-backend && docker compose -f docker-compose.dev.yml up -d && cd ..
cd nest-backend    && docker compose -f docker-compose.dev.yml up -d && cd ..
docker ps          # verificar: 4 contenedores arriba
```

**Paso 2 — Backend Python / FastAPI (:8000)** — terminal 1

```bash
cd fastapi-backend
.venv/Scripts/python.exe -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

**Paso 3 — Backend Node / NestJS (:3000)** — terminal 2

```bash
cd nest-backend
npm run start:dev
```

**Paso 4 — Frontend Nuxt (:3001)** — terminal 3

```bash
cd Frontend
npm run dev
```

> El puerto 3001 ya está fijado en el script `dev` de `Frontend/package.json`.
> Importante: Nest ocupa el 3000 y Nuxt trae 3000 por defecto. Si el 3001 está
> ocupado, Nuxt NO falla: hace fallback silencioso al 3000 y pisa a Nest
> (`[get-port] Unable to find an available port ... Using alternative port 3000`),
> y entonces toda llamada a `/api/v1/*` devuelve el 404 de Nitro.
> Revisa siempre que el log diga `➜ Local: http://localhost:3001/`.

**Verificar que todo levantó:**

- FastAPI → http://localhost:8000/health · http://localhost:8000/docs
- NestJS  → http://localhost:3000/health
- Nuxt    → http://localhost:3001/api-status (muestra estado de ambos backends)

**Apagar al terminar el día:**

```bash
# Ctrl+C en cada terminal de los servicios, luego:
cd fastapi-backend && docker compose -f docker-compose.dev.yml down && cd ..
cd nest-backend    && docker compose -f docker-compose.dev.yml down && cd ..
```

> `down` conserva los datos (viven en volúmenes nombrados).
> `down -v` **sí borra los datos**.

---

## 8. Nombres de los contenedores Docker

Los contenedores ahora llevan nombre fijo (`container_name` en los compose) para
identificarlos como parte de este proyecto. Antes eran nombres autogenerados por
Docker Compose.

**Dev (`docker-compose.dev.yml` — solo Postgres + Redis, el que se usa a diario):**

| Nombre anterior | Nombre nuevo | Puerto host |
|-----------------|--------------|-------------|
| `fastapi-backend-postgres-1` | `fastapi-portafolio-postgres-dev` | 5434 |
| `fastapi-backend-redis-1`    | `fastapi-portafolio-redis-dev`    | 6381 |
| `nest-backend-postgres-1`    | `nest-portafolio-postgres-dev`    | 5433 |
| `nest-backend-redis-1`       | `nest-portafolio-redis-dev`       | 6380 |

**Stack completo (`docker-compose.yml` — incluye la API dentro de Docker):**

| Nombre anterior | Nombre nuevo | Puerto host |
|-----------------|--------------|-------------|
| `fastapi-backend-api-1`      | `fastapi-portafolio-api`      | 8000 |
| `fastapi-backend-postgres-1` | `fastapi-portafolio-postgres` | 5432 |
| `fastapi-backend-redis-1`    | `fastapi-portafolio-redis`    | 6379 |
| `nest-backend-api-1`         | `nest-portafolio-api`         | 3000 |
| `nest-backend-postgres-1`    | `nest-portafolio-postgres`    | 5433 |
| `nest-backend-redis-1`       | `nest-portafolio-redis`       | 6380 |

> El sufijo `-dev` evita que los contenedores de dev y los del stack completo
> choquen por nombre si alguna vez se levantan los dos.

**Aplicar el renombrado** (la primera vez, tras cambiar los compose):

```bash
cd fastapi-backend && docker compose -f docker-compose.dev.yml up -d --force-recreate && cd ..
cd nest-backend    && docker compose -f docker-compose.dev.yml up -d --force-recreate && cd ..
```

> Los datos **no se pierden**: viven en los volúmenes (`pgdata_dev`,
> `pgdata_nest_dev`), que no dependen del nombre del contenedor.

**Comandos útiles con los nombres nuevos:**

```bash
docker logs -f nest-portafolio-postgres-dev                       # ver logs
docker exec -it nest-portafolio-postgres-dev psql -U postgres -d portfolio_nest
docker exec -it fastapi-portafolio-postgres-dev psql -U postgres -d portfolio
docker exec -it fastapi-portafolio-redis-dev redis-cli
docker stop fastapi-portafolio-postgres-dev                       # parar uno solo
```
