# ⬡ NestJS 10 — Setup completo con pnpm

> **Stack:** NestJS 10 · TypeScript 5 · TypeORM · PostgreSQL · Redis · Bull · Passport JWT · Swagger OpenAPI · Socket.IO · EventEmitter2  
> **Arquitectura:** MVC + Hexagonal (Ports & Adapters) + Clean Architecture + CQRS + DDD

---

## 1. Crear el proyecto

```bash
pnpm add -g @nestjs/cli

nest new apps/backend \
  --package-manager pnpm \
  --language TypeScript \
  --strict

cd apps/backend
```
$ cd apps/backend
$ pnpm run start
---

## 2. Instalar dependencias de producción

```bash
# Core NestJS (platform)
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express

# Configuración de entorno
pnpm add @nestjs/config

# Base de datos (TypeORM + PostgreSQL)
pnpm add @nestjs/typeorm typeorm pg

# Caché (Redis + cache-manager)
pnpm add @nestjs/cache-manager cache-manager ioredis

# Cola de tareas (Bull + Redis)
pnpm add @nestjs/bull bull

# Autenticación (JWT + Passport)
pnpm add @nestjs/passport @nestjs/jwt \
  passport passport-jwt passport-local \
  bcrypt

# Tipos de Passport
pnpm add -D @types/passport-jwt @types/passport-local @types/bcrypt

# Validación y transformación de DTOs
pnpm add class-validator class-transformer zod

# HTTP client (llamadas a OpenTrivia DB y FastAPI)
pnpm add @nestjs/axios axios

# Eventos de dominio
pnpm add @nestjs/event-emitter eventemitter2

# WebSockets — Socket.IO Gateway (multijugador + SSE)
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io

# Documentación automática (Swagger / OpenAPI)
pnpm add @nestjs/swagger swagger-ui-express

# Seguridad
pnpm add helmet @nestjs/throttler

# Utilidades
pnpm add rxjs reflect-metadata
```

---

## 3. Instalar dependencias de desarrollo

```bash
# Testing
pnpm add -D jest @nestjs/testing \
  supertest @types/supertest \
  ts-jest @types/jest

# Calidad de código
pnpm add -D eslint \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  prettier \
  lint-staged husky
```

---

## 4. Crear estructura de carpetas y archivos

> Ejecutar desde la raíz de `apps/backend/` en Git Bash.

```bash
cd src

# ════════════════════════════════════════════
# MÓDULO: auth — Autenticación y Autorización
# ════════════════════════════════════════════

mkdir -p modules/auth/domain/entities \
  modules/auth/domain/interfaces \
  modules/auth/domain/value-objects \
  modules/auth/domain/events \
  modules/auth/application/use-cases \
  modules/auth/application/dtos \
  modules/auth/infrastructure/repositories \
  modules/auth/infrastructure/strategies \
  modules/auth/presentation

# Domain
touch modules/auth/domain/entities/token.entity.ts \
  modules/auth/domain/entities/session.entity.ts
touch modules/auth/domain/interfaces/auth.repository.interface.ts \
  modules/auth/domain/interfaces/token.service.interface.ts
touch modules/auth/domain/value-objects/hashed-password.vo.ts
touch modules/auth/domain/events/user-registered.event.ts \
  modules/auth/domain/events/user-logged-in.event.ts

# Application
touch modules/auth/application/use-cases/register.use-case.ts \
  modules/auth/application/use-cases/login.use-case.ts \
  modules/auth/application/use-cases/refresh-token.use-case.ts \
  modules/auth/application/use-cases/logout.use-case.ts \
  modules/auth/application/use-cases/verify-email.use-case.ts
touch modules/auth/application/dtos/register.dto.ts \
  modules/auth/application/dtos/login.dto.ts \
  modules/auth/application/dtos/refresh.dto.ts \
  modules/auth/application/dtos/auth-response.dto.ts

# Infrastructure
touch modules/auth/infrastructure/repositories/auth.repository.ts
touch modules/auth/infrastructure/strategies/jwt.strategy.ts \
  modules/auth/infrastructure/strategies/local.strategy.ts

# Presentation + Module
touch modules/auth/presentation/auth.controller.ts
touch modules/auth/auth.module.ts

# ════════════════════════════════════════════
# MÓDULO: users — Gestión de Usuarios
# ════════════════════════════════════════════

mkdir -p modules/users/domain/entities \
  modules/users/domain/interfaces \
  modules/users/domain/value-objects \
  modules/users/domain/events \
  modules/users/application/use-cases \
  modules/users/application/dtos \
  modules/users/infrastructure/repositories \
  modules/users/presentation

# Domain
touch modules/users/domain/entities/user.entity.ts
touch modules/users/domain/interfaces/user.repository.interface.ts
touch modules/users/domain/value-objects/email.vo.ts \
  modules/users/domain/value-objects/role.vo.ts
touch modules/users/domain/events/profile-updated.event.ts

# Application
touch modules/users/application/use-cases/get-profile.use-case.ts \
  modules/users/application/use-cases/update-profile.use-case.ts \
  modules/users/application/use-cases/get-user-history.use-case.ts \
  modules/users/application/use-cases/delete-account.use-case.ts
touch modules/users/application/dtos/update-profile.dto.ts \
  modules/users/application/dtos/user-response.dto.ts

# Infrastructure
touch modules/users/infrastructure/repositories/user.repository.ts

# Presentation + Module
touch modules/users/presentation/users.controller.ts
touch modules/users/users.module.ts

# ════════════════════════════════════════════
# MÓDULO: quiz — Gestión de Quizzes y Preguntas
# ════════════════════════════════════════════

mkdir -p modules/quiz/domain/entities \
  modules/quiz/domain/interfaces \
  modules/quiz/domain/value-objects \
  modules/quiz/domain/events \
  modules/quiz/application/use-cases \
  modules/quiz/application/dtos \
  modules/quiz/infrastructure/repositories \
  modules/quiz/infrastructure/clients \
  modules/quiz/presentation

# Domain
touch modules/quiz/domain/entities/quiz.entity.ts \
  modules/quiz/domain/entities/question.entity.ts \
  modules/quiz/domain/entities/quiz-session.entity.ts
touch modules/quiz/domain/interfaces/quiz.repository.interface.ts \
  modules/quiz/domain/interfaces/trivia-client.interface.ts
touch modules/quiz/domain/value-objects/difficulty.vo.ts \
  modules/quiz/domain/value-objects/category.vo.ts
touch modules/quiz/domain/events/quiz-created.event.ts \
  modules/quiz/domain/events/quiz-started.event.ts \
  modules/quiz/domain/events/quiz-completed.event.ts

# Application
touch modules/quiz/application/use-cases/create-quiz.use-case.ts \
  modules/quiz/application/use-cases/get-quiz.use-case.ts \
  modules/quiz/application/use-cases/list-quizzes.use-case.ts \
  modules/quiz/application/use-cases/fetch-trivia-questions.use-case.ts \
  modules/quiz/application/use-cases/start-session.use-case.ts \
  modules/quiz/application/use-cases/submit-answer.use-case.ts \
  modules/quiz/application/use-cases/end-session.use-case.ts
touch modules/quiz/application/dtos/create-quiz.dto.ts \
  modules/quiz/application/dtos/fetch-questions.dto.ts \
  modules/quiz/application/dtos/submit-answer.dto.ts \
  modules/quiz/application/dtos/quiz-response.dto.ts

# Infrastructure
touch modules/quiz/infrastructure/repositories/quiz.repository.ts
touch modules/quiz/infrastructure/clients/open-trivia.client.ts

# Presentation + Module
touch modules/quiz/presentation/quiz.controller.ts
touch modules/quiz/quiz.module.ts

# ════════════════════════════════════════════
# MÓDULO: score — Puntuaciones y Logros
# ════════════════════════════════════════════

mkdir -p modules/score/domain/entities \
  modules/score/domain/interfaces \
  modules/score/domain/value-objects \
  modules/score/domain/events \
  modules/score/application/use-cases \
  modules/score/application/dtos \
  modules/score/infrastructure/repositories \
  modules/score/presentation

# Domain
touch modules/score/domain/entities/score.entity.ts \
  modules/score/domain/entities/achievement.entity.ts
touch modules/score/domain/interfaces/score.repository.interface.ts \
  modules/score/domain/interfaces/achievement.repository.interface.ts
touch modules/score/domain/value-objects/points.vo.ts
touch modules/score/domain/events/score-updated.event.ts \
  modules/score/domain/events/achievement-unlocked.event.ts

# Application
touch modules/score/application/use-cases/calculate-score.use-case.ts \
  modules/score/application/use-cases/save-score.use-case.ts \
  modules/score/application/use-cases/get-leaderboard.use-case.ts \
  modules/score/application/use-cases/get-user-history.use-case.ts \
  modules/score/application/use-cases/check-achievements.use-case.ts
touch modules/score/application/dtos/submit-score.dto.ts \
  modules/score/application/dtos/leaderboard-response.dto.ts

# Infrastructure
touch modules/score/infrastructure/repositories/score.repository.ts \
  modules/score/infrastructure/repositories/achievement.repository.ts

# Presentation + Module
touch modules/score/presentation/score.controller.ts
touch modules/score/score.module.ts

# ════════════════════════════════════════════
# MÓDULO: notifications — Tiempo Real (SSE + WebSocket)
# ════════════════════════════════════════════

mkdir -p modules/notifications/domain/interfaces \
  modules/notifications/application/use-cases \
  modules/notifications/infrastructure/gateways \
  modules/notifications/presentation

# Domain
touch modules/notifications/domain/interfaces/notification.interface.ts

# Application
touch modules/notifications/application/use-cases/broadcast-event.use-case.ts

# Infrastructure — WebSocket Gateway (Socket.IO)
touch modules/notifications/infrastructure/gateways/notifications.gateway.ts

# Presentation — SSE endpoint
touch modules/notifications/presentation/sse.controller.ts
touch modules/notifications/notifications.module.ts

# ════════════════════════════════════════════
# shared/ — Cross-Cutting Concerns (AOP)
# ════════════════════════════════════════════

mkdir -p shared/guards \
  shared/interceptors \
  shared/pipes \
  shared/filters \
  shared/decorators \
  shared/config

# Guards (Chain of Responsibility)
touch shared/guards/jwt-auth.guard.ts \
  shared/guards/roles.guard.ts \
  shared/guards/throttler.guard.ts

# Interceptors (AOP)
touch shared/interceptors/logging.interceptor.ts \
  shared/interceptors/transform.interceptor.ts \
  shared/interceptors/timeout.interceptor.ts

# Pipes (validación global)
touch shared/pipes/validation.pipe.ts

# Filters (manejo centralizado de errores)
touch shared/filters/http-exception.filter.ts

# Decorators custom
touch shared/decorators/roles.decorator.ts \
  shared/decorators/current-user.decorator.ts \
  shared/decorators/public.decorator.ts \
  shared/decorators/api-response.decorator.ts

# Config factories
touch shared/config/database.config.ts \
  shared/config/jwt.config.ts \
  shared/config/redis.config.ts \
  shared/config/throttler.config.ts

# Root module + bootstrap
touch app.module.ts main.ts

# ════════════════════════════════════════════
# __tests__/ — Suite de pruebas completa
# ════════════════════════════════════════════

mkdir -p ../__tests__/unit/use-cases/auth \
  ../__tests__/unit/use-cases/quiz \
  ../__tests__/unit/use-cases/score \
  ../__tests__/unit/guards \
  ../__tests__/unit/pipes \
  ../__tests__/unit/value-objects \
  ../__tests__/unit/interceptors \
  ../__tests__/integration/auth \
  ../__tests__/integration/quiz \
  ../__tests__/integration/score \
  ../__tests__/integration/notifications \
  ../__tests__/functional \
  ../__tests__/performance/k6 \
  ../__tests__/performance/artillery \
  ../__tests__/usability

# Unitarias — use-cases auth
touch ../__tests__/unit/use-cases/auth/register.use-case.spec.ts \
  ../__tests__/unit/use-cases/auth/login.use-case.spec.ts \
  ../__tests__/unit/use-cases/auth/refresh-token.use-case.spec.ts

# Unitarias — use-cases quiz
touch ../__tests__/unit/use-cases/quiz/fetch-trivia.use-case.spec.ts \
  ../__tests__/unit/use-cases/quiz/submit-answer.use-case.spec.ts \
  ../__tests__/unit/use-cases/quiz/end-session.use-case.spec.ts

# Unitarias — use-cases score
touch ../__tests__/unit/use-cases/score/calculate-score.use-case.spec.ts \
  ../__tests__/unit/use-cases/score/check-achievements.use-case.spec.ts

# Unitarias — guards
touch ../__tests__/unit/guards/jwt-auth.guard.spec.ts \
  ../__tests__/unit/guards/roles.guard.spec.ts

# Unitarias — pipes
touch ../__tests__/unit/pipes/validation.pipe.spec.ts

# Unitarias — value objects
touch ../__tests__/unit/value-objects/email.vo.spec.ts \
  ../__tests__/unit/value-objects/points.vo.spec.ts

# Unitarias — interceptors
touch ../__tests__/unit/interceptors/transform.interceptor.spec.ts

# Integración (Jest + Supertest + BD de test)
touch ../__tests__/integration/auth/register.integration.spec.ts \
  ../__tests__/integration/auth/login.integration.spec.ts \
  ../__tests__/integration/auth/refresh.integration.spec.ts
touch ../__tests__/integration/quiz/fetch-questions.integration.spec.ts \
  ../__tests__/integration/quiz/session.integration.spec.ts
touch ../__tests__/integration/score/submit.integration.spec.ts \
  ../__tests__/integration/score/leaderboard.integration.spec.ts
touch ../__tests__/integration/notifications/sse.integration.spec.ts

# Funcionales E2E (Jest + Supertest)
touch ../__tests__/functional/auth-flow.e2e-spec.ts \
  ../__tests__/functional/quiz-flow.e2e-spec.ts \
  ../__tests__/functional/rbac.e2e-spec.ts \
  ../__tests__/functional/rate-limiting.e2e-spec.ts \
  ../__tests__/functional/full-game.e2e-spec.ts

# Rendimiento — k6
touch ../__tests__/performance/k6/quiz-questions.k6.js \
  ../__tests__/performance/k6/score-submit.k6.js \
  ../__tests__/performance/k6/jwt-validation.k6.js

# Rendimiento — Artillery (SSE)
touch ../__tests__/performance/artillery/sse-load.yml \
  ../__tests__/performance/artillery/artillery.config.yml

# Usabilidad — contratos OpenAPI
touch ../__tests__/usability/error-messages.spec.ts \
  ../__tests__/usability/swagger-contract.spec.ts \
  ../__tests__/usability/response-envelope.spec.ts \
  ../__tests__/usability/api-versioning.spec.ts

# ════════════════════════════════════════════
# Archivos de configuración raíz
# ════════════════════════════════════════════

touch ../nest-cli.json \
  ../tsconfig.json \
  ../tsconfig.build.json \
  ../jest.config.ts \
  ../jest.e2e.config.ts \
  ../.env.example
```
