# FastAPI Enterprise Backend — Portfolio

Backend del portfolio, arquitectura enterprise: DDD por bounded context, capas
Controller → Service → Repository, SOLID + DRY + Clean Code. Async de punta a punta.

## Estado (vertical slice)

| Módulo | Estado |
|--------|--------|
| `common` / `infrastructure` / `config` | ✅ funcional |
| `auth` (register / login / refresh + rotación / logout) | ✅ funcional |
| `user` (CRUD + `/me` + paginación + guard de rol) | ✅ funcional |
| `chat` · `contact` · `notification` · `project` | 🟡 stub (routers 501, contrato documentado) |
| gRPC · Celery/queue · email service | 🟡 pendiente (estructura reservada) |

## Stack

- **FastAPI** + Uvicorn
- **SQLAlchemy 2.0 async** + asyncpg + **Alembic**
- **Pydantic v2** / pydantic-settings
- **PyJWT** (access + refresh con rotación por `jti`) · **argon2** hashing
- **Redis** (cache + rate limit)
- **pytest-asyncio** + SQLite in-memory

## Arranque rápido (dev)

```bash
cp .env.example .env            # ajusta JWT_SECRET
make infra                      # postgres + redis (docker-compose.dev.yml)
poetry install
alembic revision --autogenerate -m "init"   # genera primera migración
alembic upgrade head
make dev                        # uvicorn --reload en :8000
```

Docs interactivas: http://localhost:8000/docs · Health: `/health`

## Stack completo con Docker

```bash
cp .env.example .env
make up          # api + postgres + redis; corre migraciones al arrancar
```

## Endpoints activos (`/api/v1`)

```
POST /auth/register    POST /auth/login    POST /auth/refresh    POST /auth/logout
GET  /users/me         GET  /users (admin) POST /users (admin)
GET  /users/{id}       PATCH /users/{id}   DELETE /users/{id} (admin)
```

Respuesta estándar: `ApiResponse[T]` → `{ success, data, message }`.

## Tests

```bash
make test        # pytest -q  (unit auth: token + service, SQLite in-memory)
```

## Estructura

Ver `../fastapi-annotated.md` — árbol anotado con patrones/paradigmas/SOLID.
Los módulos stub conservan la estructura de carpetas prevista y documentan su
contrato en el docstring del router.
