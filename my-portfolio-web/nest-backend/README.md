# NestJS Enterprise Backend — Portfolio

Backend del portfolio en NestJS. Arquitectura enterprise: DDD por bounded context,
capas Controller → Service → Repository, SOLID + DRY + Clean Code. Paridad con
`../fastapi-backend/` (mismo dominio, otra stack).

## Estado (vertical slice)

| Módulo | Estado |
|--------|--------|
| `common` / `infrastructure` / `config` | ✅ funcional |
| `auth` (register / login / refresh + rotación / logout) | ✅ funcional |
| `user` (CRUD + `/me` + paginación + guard de rol) | ✅ funcional |
| `chat` · `contact` · `notification` · `project` | 🟡 stub (controllers 501, contrato documentado) |
| gRPC · queue (BullMQ) · email real | 🟡 pendiente (estructura reservada) |

## Stack

- **NestJS 10** + Express
- **Prisma 5** + Postgres
- **Zod** (validación via `ZodValidationPipe`)
- **Passport** (jwt / jwt-refresh / local) + `@nestjs/jwt` — access + refresh con rotación por `jti`
- **argon2** hashing · **ioredis** (cache)
- **Jest** + ts-jest (unit con repos fake; e2e con Prisma real)

## Wiring global (app.module)

- `APP_GUARD` → `JwtAuthGuard` (todo protegido salvo `@Public()`)
- `APP_INTERCEPTOR` → timeout(30s) → logging → response envelope `ApiResponse<T>`
- `APP_FILTER` → `GlobalExceptionFilter` (errores en formato uniforme)
- middleware `RequestIdMiddleware` (X-Request-ID)

## Arranque rápido (dev)

```bash
cp .env.example .env            # ajusta JWT_SECRET / JWT_REFRESH_SECRET
docker compose -f docker-compose.dev.yml up -d   # postgres:5433 + redis:6380
npm install
npx prisma generate
npx prisma migrate dev --name init               # crea tablas
npm run start:dev                                # :3000
```

Health: `http://localhost:3000/health`

## Stack completo con Docker

```bash
cp .env.example .env
docker compose up --build       # api + postgres + redis; migrate deploy al arrancar
```

## Endpoints activos (`/api/v1`)

```
POST /auth/register    POST /auth/login    POST /auth/refresh    POST /auth/logout
GET  /users/me         GET  /users (admin) POST /users (admin)
GET  /users/:id        PATCH /users/:id    DELETE /users/:id (admin)
```

Respuesta estándar: `{ success, data, message? }`.

## Tests

```bash
npm test          # unit: token + auth + user services (repos fake, sin DB)
npm run test:e2e  # integración: requiere Postgres + migraciones aplicadas
```

## Estructura

Ver `../nestjs-annotated.md` — árbol anotado con patrones/paradigmas/SOLID.
Los módulos stub conservan la estructura prevista y documentan su contrato en el
comentario de cabecera del módulo.
