# NestJS 11 — Estructura de Carpetas

## Tipo de Arquitectura

**MVC + Hexagonal (Ports & Adapters) + Clean Architecture + CQRS + DDD**

| Capa MVC        | Implementación en NestJS                                                         |
|-----------------|----------------------------------------------------------------------------------|
| **Model**       | `domain/entities/` · `domain/value-objects/` · TypeORM entities                 |
| **View**        | DTOs de respuesta + Swagger auto-docs (`@nestjs/swagger`)                        |
| **Controller**  | `presentation/` Controllers (`@Controller`) + Guards + Pipes + Interceptors      |
| **Lógica**      | `application/use-cases/` Services que orquestan casos de uso                     |
| **Persistencia**| `infrastructure/repositories/` TypeORM + Redis (implementan Ports del dominio)  |

**Patrones de Diseño:** Repository · Factory · Observer (@nestjs/event-emitter) · Decorator · Guard · Strategy (Passport) · Facade (Services) · Chain of Responsibility (Pipes+Guards) · Command (Use Cases) · Unit of Work (TypeORM) · Adapter (OpenTrivia client · OllamaClient · cliente HTTP de FastAPI · viem) · Template Method (proveedores Aya, Qwen y Mistral) · Saga (Bull queues)

**Paradigmas:** OOP (clases/decoradores) · Reactivo (RxJS Observable) · Orientado a Eventos (@nestjs/event-emitter) · AOP (Interceptors/Guards) · Async/Await

**Prácticas:** SOLID · DRY · Clean Code · Type-Safe (TS strict + class-validator + Zod) · JWT Auth · RBAC · Rate Limiting · OpenAPI auto-gen · Rutas protegidas (JwtAuthGuard global + @Public() opt-out)

**Tecnologías:** NestJS 11 · TypeScript 5 · TypeORM · PostgreSQL · Redis · Bull · Passport JWT · Swagger OpenAPI · Ollama (Aya, Qwen, Mistral) · viem (Sepolia, sin contratos) · Jest · Supertest · k6 · Artillery · ESLint · Prettier

---

## Estructura de Carpetas Completa

```
apps/backend/                                  # MVC: View=DTOs+Swagger · Controller=presentation/ · Model=domain/
├── src/
│   │
│   ├── modules/                               # Bounded Contexts (DDD)
│   │   │
│   │   ├── auth/                              # Contexto: Autenticación y Autorización
│   │   │   ├── domain/                        # Capa Dominio — sin dependencias externas (DIP)
│   │   │   │   ├── entities/
│   │   │   │   │   ├── token.entity.ts        # Entidad: access + refresh token con TTL
│   │   │   │   │   └── session.entity.ts      # Entidad: sesión activa por dispositivo
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── auth.repository.interface.ts     # Port (DIP): operaciones de auth en BD
│   │   │   │   │   └── token.service.interface.ts       # Port (DIP): sign + verify JWT
│   │   │   │   ├── value-objects/
│   │   │   │   │   └── hashed-password.vo.ts            # VO: password hasheada inmutable
│   │   │   │   └── events/
│   │   │   │       ├── user-registered.event.ts         # Evento dominio: nuevo usuario creado
│   │   │   │       └── user-logged-in.event.ts          # Evento dominio: login exitoso
│   │   │   ├── application/                   # Capa Aplicación — casos de uso (SRP)
│   │   │   │   ├── use-cases/
│   │   │   │   │   ├── register.use-case.ts   # UC: validar + hash bcrypt + crear user + emitir evento
│   │   │   │   │   ├── login.use-case.ts      # UC: verificar creds + emitir JWT pair
│   │   │   │   │   ├── refresh-token.use-case.ts        # UC: rotar refresh token en BD
│   │   │   │   │   ├── logout.use-case.ts               # UC: invalidar token + limpiar sesión
│   │   │   │   │   └── verify-email.use-case.ts         # UC: validar token de verificación
│   │   │   │   └── dtos/
│   │   │   │       ├── register.dto.ts        # DTO entrada: email, password, name (class-validator)
│   │   │   │       ├── login.dto.ts           # DTO entrada: email, password
│   │   │   │       ├── refresh.dto.ts         # DTO entrada: refreshToken string
│   │   │   │       └── auth-response.dto.ts   # DTO salida: accessToken, refreshToken, user
│   │   │   ├── infrastructure/                # Capa Infraestructura — Adapters concretos
│   │   │   │   ├── repositories/
│   │   │   │   │   └── auth.repository.ts     # Impl TypeORM del port auth.repository.interface
│   │   │   │   └── strategies/
│   │   │   │       ├── jwt.strategy.ts        # Adapter: Passport JWT → port TokenService
│   │   │   │       └── local.strategy.ts      # Adapter: Passport Local para login form
│   │   │   ├── presentation/                  # Capa Presentación — Controllers
│   │   │   │   └── auth.controller.ts         # Rutas públicas: POST /auth/register, /login, /refresh
│   │   │   └── auth.module.ts                 # Módulo: providers, imports, exports
│   │   │
│   │   ├── users/                             # Contexto: Gestión de Usuarios
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── user.entity.ts         # Entidad: id, email, name, avatar, roles, createdAt
│   │   │   │   ├── interfaces/
│   │   │   │   │   └── user.repository.interface.ts     # Port (DIP)
│   │   │   │   ├── value-objects/
│   │   │   │   │   ├── email.vo.ts            # VO: email validado con regex + lowercase
│   │   │   │   │   └── role.vo.ts             # VO: enum USER | TEACHER | ADMIN
│   │   │   │   └── events/
│   │   │   │       └── profile-updated.event.ts
│   │   │   ├── application/
│   │   │   │   ├── use-cases/
│   │   │   │   │   ├── get-profile.use-case.ts          # UC: obtener perfil propio por userId
│   │   │   │   │   ├── update-profile.use-case.ts       # UC: editar nombre, avatar, bio
│   │   │   │   │   ├── get-user-history.use-case.ts     # UC: historial de quizzes del usuario
│   │   │   │   │   └── delete-account.use-case.ts       # UC: baja GDPR + anonimización
│   │   │   │   └── dtos/
│   │   │   │       ├── update-profile.dto.ts
│   │   │   │       └── user-response.dto.ts             # DTO salida: sin password, sin tokens
│   │   │   ├── infrastructure/
│   │   │   │   └── repositories/
│   │   │   │       └── user.repository.ts     # Impl TypeORM con soft-delete
│   │   │   ├── presentation/
│   │   │   │   └── users.controller.ts        # Rutas protegidas: GET/PUT /users/me
│   │   │   └── users.module.ts
│   │   │
│   │   ├── quiz/                              # Contexto: Gestión de Quizzes y Preguntas
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── quiz.entity.ts         # Entidad: título, categoría, dificultad, owner
│   │   │   │   │   ├── question.entity.ts     # Entidad: texto, opciones[], respuesta correcta
│   │   │   │   │   └── quiz-session.entity.ts # Entidad: sesión de juego activa
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── quiz.repository.interface.ts
│   │   │   │   │   └── trivia-client.interface.ts       # Port: cliente externo OpenTrivia
│   │   │   │   ├── value-objects/
│   │   │   │   │   ├── difficulty.vo.ts       # VO: 'easy' | 'medium' | 'hard'
│   │   │   │   │   └── category.vo.ts         # VO: ID categoría OpenTrivia validado
│   │   │   │   └── events/
│   │   │   │       ├── quiz-created.event.ts
│   │   │   │       ├── quiz-started.event.ts
│   │   │   │       └── quiz-completed.event.ts          # Trigger → score + notificaciones + IA
│   │   │   ├── application/
│   │   │   │   ├── use-cases/
│   │   │   │   │   ├── create-quiz.use-case.ts          # UC: crear quiz personalizado + emitir evento
│   │   │   │   │   ├── get-quiz.use-case.ts             # UC: obtener quiz por ID con preguntas
│   │   │   │   │   ├── list-quizzes.use-case.ts         # UC: listar con filtros paginados
│   │   │   │   │   ├── fetch-trivia-questions.use-case.ts # UC: fetch OpenTrivia + cacheo Redis 1h
│   │   │   │   │   ├── start-session.use-case.ts        # UC: crear QuizSession + timestamp inicio
│   │   │   │   │   ├── submit-answer.use-case.ts        # UC: registrar respuesta + avanzar
│   │   │   │   │   └── end-session.use-case.ts          # UC: cerrar sesión + emitir QuizCompleted
│   │   │   │   └── dtos/
│   │   │   │       ├── create-quiz.dto.ts
│   │   │   │       ├── fetch-questions.dto.ts           # Params: amount, category, difficulty, type
│   │   │   │       ├── submit-answer.dto.ts
│   │   │   │       └── quiz-response.dto.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── repositories/
│   │   │   │   │   └── quiz.repository.ts     # Impl TypeORM: relaciones + eager loading
│   │   │   │   ├── clients/
│   │   │   │   │   ├── open-trivia.client.ts  # Adapter: REST OpenTrivia → port TriviaClient
│   │   │   │   │   ├── base-ollama-ai.provider.ts # Template Method: prompt, parser y validación; HTTP con OllamaClient
│   │   │   │   │   ├── aya.provider.ts        # Proveedor Aya Expanse (OLLAMA_AYA_MODEL)
│   │   │   │   │   ├── qwen.provider.ts       # Proveedor Qwen (OLLAMA_QWEN_MODEL)
│   │   │   │   │   └── mistral.provider.ts    # Proveedor Mistral Nemo (OLLAMA_MISTRAL_MODEL)
│   │   │   │   └── factories/
│   │   │   │       └── ai-provider.factory.ts # Factory + Registry: proveedor elegido y respaldo opcional
│   │   │   ├── presentation/
│   │   │   │   └── quiz.controller.ts         # Rutas mixtas: públicas (GET /quiz) + protegidas (POST)
│   │   │   └── quiz.module.ts
│   │   │
│   │   ├── score/                             # Contexto: Puntuaciones y Logros
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── score.entity.ts        # Entidad: puntos, tiempo, accuracy, userId, quizId
│   │   │   │   │   └── achievement.entity.ts  # Entidad: tipo, desbloqueado, userId
│   │   │   │   ├── interfaces/
│   │   │   │   │   ├── score.repository.interface.ts
│   │   │   │   │   └── achievement.repository.interface.ts
│   │   │   │   ├── value-objects/
│   │   │   │   │   └── points.vo.ts           # VO: float >= 0 con fórmula bonus encapsulada
│   │   │   │   └── events/
│   │   │   │       ├── score-updated.event.ts
│   │   │   │       └── achievement-unlocked.event.ts
│   │   │   ├── application/
│   │   │   │   ├── use-cases/
│   │   │   │   │   ├── calculate-score.use-case.ts      # UC: puntos base + bonus velocidad/dificultad
│   │   │   │   │   ├── save-score.use-case.ts           # UC: persistir Score + emitir ScoreUpdated
│   │   │   │   │   ├── get-leaderboard.use-case.ts      # UC: top N global/categoría/período + caché
│   │   │   │   │   ├── get-user-history.use-case.ts     # UC: historial paginado por usuario
│   │   │   │   │   └── check-achievements.use-case.ts   # UC: evaluar condiciones de logros
│   │   │   │   └── dtos/
│   │   │   │       ├── submit-score.dto.ts
│   │   │   │       └── leaderboard-response.dto.ts
│   │   │   ├── infrastructure/
│   │   │   │   └── repositories/
│   │   │   │       ├── score.repository.ts
│   │   │   │       └── achievement.repository.ts
│   │   │   ├── presentation/
│   │   │   │   └── score.controller.ts        # POST /score/submit + GET /score/leaderboard
│   │   │   └── score.module.ts
│   │   │
│   │   ├── ai/                                # Contexto: Puerta de IA (Ollama y FastAPI)
│   │   │   ├── ollama.client.ts               # Gateway: ÚNICO cliente HTTP de Ollama (generate, show, ps, métricas, errores)
│   │   │   ├── ai-client.service.ts           # Gateway: cliente HTTP hacia FastAPI con timeout y JWT propagado
│   │   │   ├── ai.controller.ts               # Proxy /ai/feedback/* hacia FastAPI
│   │   │   └── ai.module.ts                   # @Global: exporta OllamaClient y AIClientService
│   │   │
│   │   ├── own-llm/                           # Contexto: LLM propio — puerta hacia FastAPI own_llm (RF-144)
│   │   │   ├── domain/ports/writing-corrector.port.ts # Port: WritingCorrectorPort
│   │   │   ├── application/use-cases/correct-writing.use-case.ts # UC: corregir una redacción
│   │   │   ├── infrastructure/ai/own-llm-client.adapter.ts # Adapter: HTTP hacia FastAPI /own-llm/correct (AIClientService)
│   │   │   ├── presentation/writing-corrections.controller.ts # POST /own-llm/writing-corrections + GET /own-llm/scope
│   │   │   └── own-llm.module.ts
│   │   │
│   │   ├── audio/                             # Contexto: Audio de pronunciación con caché (RF-55)
│   │   │   ├── domain/entities/pronunciation-audio.entity.ts # Entidad: texto, idioma, acento, clave y ruta en MinIO
│   │   │   ├── domain/ports/speech-synthesis.port.ts # Port: voz local (espeak-ng vía FastAPI LanguageTools)
│   │   │   ├── domain/ports/audio-storage.port.ts # Port: objeto en MinIO
│   │   │   ├── application/use-cases/get-or-create-audio.use-case.ts # UC: Cache-Aside — genera una sola vez
│   │   │   ├── application/use-cases/invalidate-audio.use-case.ts # UC: invalida un audio (ADMIN)
│   │   │   ├── infrastructure/speech/language-tools-speech.adapter.ts # Adapter: FastAPI /language-tools/speak
│   │   │   ├── infrastructure/storage/minio-audio.storage.ts # Adapter: MinIO con Range 206
│   │   │   ├── presentation/audio.controller.ts # POST /audio/pronunciations + GET /:key + DELETE /:key
│   │   │   └── audio.module.ts
│   │   │
│   │   ├── health/                            # Contexto: salud y métricas (Infrastructure, RF-82)
│   │   │   └── health.controller.ts           # GET /health (BD, Redis, FastAPI, Ollama) + GET /metrics
│   │   │
│   │   ├── web3/                              # Contexto: Blockchain sin contratos (Sepolia · viem)
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── wallet.entity.ts       # Entidad: billetera vinculada por SIWE (EIP-4361)
│   │   │   │   │   └── crypto-payment.entity.ts # Entidad: PENDIENTE → CONFIRMANDO → PAGADO / FALLIDO / EXPIRADO
│   │   │   │   ├── ports/
│   │   │   │   │   └── blockchain-gateway.port.ts # Port: sendTransaction, getTransaction, getConfirmations
│   │   │   │   └── value-objects/
│   │   │   │       └── evm-address.vo.ts      # VO: dirección EVM con checksum EIP-55
│   │   │   ├── application/
│   │   │   │   └── use-cases/
│   │   │   │       ├── create-siwe-nonce.use-case.ts # UC: nonce SIWE de un solo uso
│   │   │   │       ├── verify-siwe-and-link-wallet.use-case.ts # UC: verifica la firma con viem y vincula
│   │   │   │       ├── create-crypto-payment.use-case.ts # UC: pago PENDIENTE con tasa fija de demostración
│   │   │   │       ├── register-crypto-payment-tx.use-case.ts # UC: registra txHash (idempotente) y encola la verificación
│   │   │   │       ├── confirm-onchain-payment.use-case.ts # UC: remitente, red, destinatario, monto y confirmaciones
│   │   │   │       ├── anchor-certificate-hash.use-case.ts # UC: ancla el hash SHA-256 del PDF en Sepolia
│   │   │   │       └── verify-certificate-onchain.use-case.ts # UC: compara el hash anclado con el del PDF (RF-93)
│   │   │   ├── infrastructure/
│   │   │   │   ├── chain/
│   │   │   │   │   ├── viem-blockchain.adapter.ts # Adapter: Sepolia; RPC y clave de la plataforma por variables de entorno
│   │   │   │   │   └── fake-blockchain.adapter.ts # Adapter en memoria para pruebas, sin red
│   │   │   │   └── jobs/
│   │   │   │       ├── crypto-payment-verification.processor.ts # Bull: verificación del pago en segundo plano con reintentos
│   │   │   │       └── certificate-anchor.processor.ts # Bull: anclaje del hash del certificado
│   │   │   ├── presentation/
│   │   │   │   ├── wallets.controller.ts      # POST /web3/wallets/nonce + /verify
│   │   │   │   └── crypto-payments.controller.ts # POST /web3/payments + PATCH /web3/payments/:id/tx
│   │   │   └── web3.module.ts
│   │   │
│   │   └── notifications/                     # Contexto: Notificaciones en Tiempo Real
│   │       ├── domain/
│   │       │   └── interfaces/
│   │       │       └── notification.interface.ts        # Port: emitir evento a canal de usuario
│   │       ├── application/
│   │       │   └── use-cases/
│   │       │       └── broadcast-event.use-case.ts      # UC: emitir payload a canal de usuario
│   │       ├── infrastructure/
│   │       │   └── gateways/
│   │       │       └── notifications.gateway.ts         # Gateway WebSocket (Adapter; Socket.IO reservado, las notificaciones usan SSE)
│   │       ├── presentation/
│   │       │   └── sse.controller.ts          # GET /events: SSE endpoint por usuario autenticado
│   │       └── notifications.module.ts
│   │
│   ├── shared/                                # Cross-Cutting Concerns (AOP)
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts              # Guard: valida JWT en cada request protegida
│   │   │   ├── roles.guard.ts                 # Guard: RBAC verifica @Roles() metadata
│   │   │   └── throttler.guard.ts             # Guard: rate limiting por IP y por usuario
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts         # AOP: log entrada/salida + duración ms
│   │   │   ├── transform.interceptor.ts       # AOP: envelope { data, meta, timestamp }
│   │   │   └── timeout.interceptor.ts         # AOP: timeout 30s por request + 503
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts             # Chain: class-validator + class-transformer global
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts       # Manejo centralizado: formato unificado de errores
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts             # @Roles(Role.ADMIN) para RolesGuard
│   │   │   ├── current-user.decorator.ts      # @CurrentUser() extrae user del JWT payload
│   │   │   ├── public.decorator.ts            # @Public() skip JwtAuthGuard en rutas abiertas
│   │   │   └── api-response.decorator.ts      # Swagger shorthand: @ApiOkResponse tipado
│   │   └── config/
│   │       ├── database.config.ts             # TypeORM factory: host, port, entities, migrations
│   │       ├── jwt.config.ts                  # JWT: secret, accessExpiry (15m), refreshExpiry (7d)
│   │       ├── redis.config.ts                # Redis: host, port, password, db index
│   │       └── throttler.config.ts            # Rate limit: ttl (60s), limit (100 req)
│   │
│   ├── app.module.ts                          # Root Module: ConfigModule, TypeORM, Redis, módulos
│   └── main.ts                                # Bootstrap: Swagger, ValidationPipe global, CORS, Helmet
│
│
├── __tests__/                                 # ══ PRUEBAS ══════════════════════════════
│   │
│   ├── unit/                                  # UNITARIAS — Jest + @nestjs/testing
│   │   │                                      # Aislamiento: todas las deps externas mockeadas
│   │   ├── use-cases/
│   │   │   ├── auth/
│   │   │   │   ├── register.use-case.spec.ts  # Hash bcrypt llamado, repo.save() invocado, evento emitido
│   │   │   │   ├── login.use-case.spec.ts     # UnauthorizedException si hash no coincide
│   │   │   │   └── refresh-token.use-case.spec.ts       # Nuevo token emitido, viejo invalidado en BD
│   │   │   ├── quiz/
│   │   │   │   ├── fetch-trivia.use-case.spec.ts        # OpenTrivia mockeado, resultado cacheado en Redis
│   │   │   │   ├── submit-answer.use-case.spec.ts       # Respuesta registrada, sesión avanza
│   │   │   │   └── end-session.use-case.spec.ts         # QuizCompleted event emitido con payload correcto
│   │   │   └── score/
│   │   │       ├── calculate-score.use-case.spec.ts     # Fórmula bonus correcta para cada dificultad
│   │   │       └── check-achievements.use-case.spec.ts  # Logro desbloqueado cuando condición cumplida
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.spec.ts         # Permite request con JWT válido, 401 sin token
│   │   │   └── roles.guard.spec.ts            # 403 para USER en ruta @Roles(ADMIN)
│   │   ├── pipes/
│   │   │   └── validation.pipe.spec.ts        # LoginDto falla con mensaje tipado para email inválido
│   │   ├── value-objects/
│   │   │   ├── email.vo.spec.ts               # Email inválido lanza DomainException
│   │   │   └── points.vo.spec.ts              # Points(-1) lanza excepción, Points(0) válido
│   │   └── interceptors/
│   │       └── transform.interceptor.spec.ts  # Respuesta envuelta en { data, meta, timestamp }
│   │
│   ├── integration/                           # INTEGRACIÓN — Jest + Supertest + BD/Redis de test
│   │   │                                      # TestingModule real con BD PostgreSQL efímera
│   │   ├── auth/
│   │   │   ├── register.integration.spec.ts   # POST /auth/register → 201 + user en BD + token
│   │   │   ├── login.integration.spec.ts      # POST /auth/login → 200 + JWT pair válido
│   │   │   └── refresh.integration.spec.ts    # POST /auth/refresh → nuevo par, viejo invalidado
│   │   ├── quiz/
│   │   │   ├── fetch-questions.integration.spec.ts      # GET /quiz/questions → caché Redis hit en 2ª llamada
│   │   │   └── session.integration.spec.ts              # POST start → submit × N → end → QuizCompleted
│   │   ├── score/
│   │   │   ├── submit.integration.spec.ts     # POST /score/submit → Score en BD + evento emitido
│   │   │   └── leaderboard.integration.spec.ts # GET /score/leaderboard → ranking ordenado correctamente
│   │   └── notifications/
│   │       └── sse.integration.spec.ts        # SSE stream recibe ScoreUpdated dentro de 1s
│   │
│   ├── functional/                            # FUNCIONALES (E2E) — Jest + Supertest
│   │   │                                      # Flujos completos contra app NestJS real
│   │   ├── auth-flow.e2e-spec.ts              # Register → login → refresh → logout completo
│   │   ├── quiz-flow.e2e-spec.ts              # Crear quiz → iniciar → responder → finalizar → score
│   │   ├── rbac.e2e-spec.ts                   # USER rechazado en rutas ADMIN con 403 correcto
│   │   ├── rate-limiting.e2e-spec.ts          # 101 req/min → 429 con Retry-After header
│   │   └── full-game.e2e-spec.ts              # Flujo completo: login → quiz → score → leaderboard
│   │
│   ├── performance/                           # RENDIMIENTO — k6 + Artillery
│   │   │                                      # Carga sostenida contra endpoints críticos
│   │   ├── k6/
│   │   │   ├── quiz-questions.k6.js           # GET /quiz/questions: >500 req/s p95<150ms (caché Redis)
│   │   │   ├── score-submit.k6.js             # POST /score/submit: >200 req/s p95<300ms (BD write)
│   │   │   └── jwt-validation.k6.js           # Auth endpoints: p99<50ms bajo 500 req/s
│   │   └── artillery/
│   │       ├── sse-load.yml                   # SSE: 1000 conexiones concurrentes <1% pérdida eventos
│   │       └── artillery.config.yml           # Config: base URL, auth headers, duración 10min
│   │
│   └── usability/                             # USABILIDAD API — Jest + Supertest
│       │                                      # Contratos de API, mensajes de error, consistencia
│       ├── error-messages.spec.ts             # Errores 400/401/403/404/429 tienen formato consistente
│       ├── swagger-contract.spec.ts           # Todos los endpoints documentados en OpenAPI
│       ├── response-envelope.spec.ts          # Todas las respuestas siguen { data, meta } estándar
│       └── api-versioning.spec.ts             # /api/v1/* funciona y retorna versión en headers
│
├── nest-cli.json                              # Config CLI: sourceRoot, monorepo paths
├── tsconfig.json                              # strict:true + experimentalDecorators + emitDecoratorMetadata
├── tsconfig.build.json                        # Build: excluye __tests__ + node_modules
├── jest.config.ts                             # Coverage: branches 80% + functions 80%
├── jest.e2e.config.ts                         # Config E2E: testMatch **/*.e2e-spec.ts
├── .env.example                               # Variables: DB_URL, JWT_SECRET, REDIS_URL, AI_URL, OLLAMA_BASE_URL, OLLAMA_AYA_MODEL, OLLAMA_QWEN_MODEL, OLLAMA_MISTRAL_MODEL, OLLAMA_CURRICULUM_MODEL, OLLAMA_KEEP_ALIVE, OLLAMA_NUM_CTX, AI_FALLBACK_ENABLED, SEPOLIA_RPC_URL (RPC público o plan gratuito de Alchemy o Infura), PLATFORM_WALLET_ADDRESS, PLATFORM_WALLET_PRIVATE_KEY, CRYPTO_DEMO_RATE, CRYPTO_MIN_CONFIRMATIONS
└── package.json
```

## Diccionario de Abreviaturas — NestJS

| Concepto / Sufijo | Significado | Patrón de Diseño | Principio SOLID |
|-------------------|-------------|------------------|-----------------|
| `domain/` | Capa sin dependencias externas | Clean Architecture núcleo | DIP |
| `application/` | Orquestación de casos de uso | Use Case Pattern | SRP |
| `infrastructure/` | Adapters concretos (BD, HTTP) | Hexagonal Architecture | DIP + OCP |
| `presentation/` | Controllers NestJS | MVC — capa de entrada | SRP |
| `.use-case.ts` | Lógica de negocio aislada | Command Pattern | SRP |
| `.entity.ts` | Objeto con identidad propia | DDD Entity | SRP |
| `.vo.ts` | Valor sin identidad, inmutable | DDD Value Object | SRP + OCP |
| `.interface.ts` | Port del dominio | Dependency Inversion | DIP + ISP |
| `.repository.ts` | Implementación del port de datos | Repository + Adapter | DIP + LSP |
| `.event.ts` | Evento de dominio inmutable | Observer + Event Sourcing | OCP |
| `.dto.ts` | Data Transfer Object tipado | Transfer Object Pattern | SRP |
| `.guard.ts` | Intercepta request por seguridad | Chain of Responsibility | SRP |
| `.interceptor.ts` | Cross-cutting concern AOP | Decorator + AOP | OCP |
| `.filter.ts` | Manejo centralizado de errores | Strategy (error handling) | SRP |
| `.pipe.ts` | Transformación y validación | Chain of Responsibility | SRP |
| `.decorator.ts` | Metadata custom con reflect | Decorator Pattern | OCP |
| `.strategy.ts` | Estrategia de autenticación | Strategy Pattern | OCP + DIP |
| `.gateway.ts` | WebSocket endpoint NestJS | Adapter (Socket.IO) | SRP |
| `.client.ts` | Cliente HTTP externo (Adapter); `ollama.client.ts` es el único hacia Ollama | Adapter Pattern | DIP + DRY |
| `.provider.ts` | Proveedor de LLM (Aya, Qwen, Mistral) sobre la clase base | Template Method + Strategy | OCP + LSP |
| `.port.ts` | Puerto del dominio (p. ej. BlockchainGatewayPort) | Ports & Adapters | DIP + ISP |
| `.adapter.ts` | Implementación del puerto (viem o falso para pruebas) | Adapter Pattern | DIP + LSP |
| `.processor.ts` | Trabajo en segundo plano con Bull | Saga / Outbox | SRP |
| `.config.ts` | Factory de configuración | Factory Pattern | SRP |
| `UC` | Use Case | Application Layer | SRP |
| `VO` | Value Object | Domain Layer | SRP |
| `Port` | Interface del dominio | DIP | DIP |
| `Adapter` | Implementación concreta del port | Hexagonal | DIP + OCP |
| `RBAC` | Role-Based Access Control | Security Pattern | SRP |
| `CV` | class-validator (decoradores) | Validation Pattern | SRP |
| `CT` | class-transformer | Transform Pattern | SRP |

## Leyenda de Prácticas Aplicadas

| Práctica | Dónde se aplica en la estructura |
|----------|----------------------------------|
| **SOLID — SRP** | Un use-case = una operación; un repositorio = un contexto |
| **SOLID — OCP** | Nuevos use-cases sin modificar existentes; ports + adapters |
| **SOLID — LSP** | Cualquier impl de IRepository reemplaza a otra sin romper |
| **SOLID — ISP** | Ports específicos por contexto (no mega-interfaces) |
| **SOLID — DIP** | Domain depende de IRepository, no de TypeORM directamente |
| **DRY** | shared/ centraliza guards, interceptors, decoradores comunes |
| **Clean Code** | Use-cases < 30 líneas, un método público por clase |
| **Type-Safe** | TS strict:true, class-validator en DTOs, Zod en dominio |
| **JWT Auth** | JwtAuthGuard global + @Public() para rutas abiertas |
| **RBAC** | @Roles() + RolesGuard + role en JWT claims |
| **Rate Limiting** | @Throttle() declarativo por endpoint o módulo |
| **OpenAPI** | @ApiTags, @ApiOperation, @ApiResponse en todos los controllers |
| **Rutas protegidas** | JwtAuthGuard aplicado globalmente, @Public() opt-out |

---

## Herramientas de Testing

| Librería | Tipo de Prueba | Para qué sirve |
|----------|---------------|----------------|
| Jest | Unitarias + Integración | Framework testing TypeScript: describe/it/expect, mocks automáticos, coverage |
| @nestjs/testing | Unitarias + Integración | TestingModule: crea módulos NestJS aislados con dependencias mockeadas |
| Supertest | Integración + Funcionales | Simula requests HTTP al servidor NestJS sin levantar puerto real |
| k6 | Rendimiento | Load testing: throughput, latencia p95/p99, escenarios de rampa de carga |
| Artillery | Rendimiento | Load testing declarativo YAML: SSE 1000 conexiones, escenarios multi-step |

## Validación de Datos

| Stack | Librerías | Por qué |
|-------|-----------|---------|
| Backend NestJS | **class-validator + class-transformer + Zod** | class-validator en DTOs con decoradores (@IsEmail, @MinLength); Zod en lógica de dominio y scripts de configuración |

## Herramientas de Calidad de Código

| Herramienta | Para qué |
|-------------|----------|
| ESLint + @typescript-eslint/eslint-plugin | Linter TypeScript con reglas estrictas: no-explicit-any, explicit-function-return-type |
| Prettier | Formateador de código — estilo consistente en todo el proyecto |
| TypeScript strict:true + experimentalDecorators | Type checking + soporte de decoradores NestJS |
| lint-staged + husky | Pre-commit hooks: ESLint + Prettier antes de cada commit |
