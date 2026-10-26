# Auditoría UML — Prompt actualizado (ProyDemo / NeuroEdu IA)

> Este archivo contiene el **prompt auditado** para regenerar/actualizar los 10 diagramas neuroeducativo-app-diagrams
> de `Documents\proyectoBorrador\neuroeducativo-app-diagrams/`. Está alineado con el **código real** del repositorio a la fecha
> (incluye las correcciones recientes: categorías académicas, eliminación de caché en generación de preguntas,
> columna `users.section`, filtros por periodo, parser IA robusto, open_answer, etc.).
>
> **REGLA MAESTRA:** los diagramas reflejan SOLO lo realmente implementado. Lo aspiracional se marca
> explícitamente como «PREVISTO / no implementado».
>
> Al final hay una sección **«Cambios de auditoría vs prompt anterior»** con la justificación y referencias al código.

---

## PROMPT

Actúa como un arquitecto de software senior, experto en UML, diseño de bases de datos, arquitectura hexagonal,microservicios, patrones GoF/DDD, y documentación técnica académica.

Actualiza 10 diagramas profesionales (neuroeducativo-app-diagrams) para el proyecto **"NeuroEdu IA / ProyDemo"**, aplicativo
neuroeducativo con agente de IA. **REGLA MAESTRA:** los diagramas reflejan SOLO lo realmente implementado en el código y no cambia el diseño de los diagramas.
Lo aspiracional se marca explícitamente como «PREVISTO / no implementado» (no como hecho).

Archivos destino (actualizar in situ, conservando numeración):
`Documents\proyectoBorrador\neuroeducativo-app-diagrams/01..10`.

### Tecnologías reales
- Backend: NestJS 11 + TypeScript + Arquitectura Hexagonal + Clean Architecture + TypeORM (synchronize en dev).
- Microservicio IA: FastAPI + Python + LangChain + FAISS + Ollama.
- Frontend: Next.js 16 + TypeScript + TailwindCSS + Auth.js v5 + Redux Toolkit.
- Base de datos: PostgreSQL.
- Caché: Redis configurado; el **caché efectivo** usa `@nestjs/cache-manager` con patrón **Cache-Aside, TTL 60s**,
  y aplica **ÚNICAMENTE en el leaderboard** (`score/GetLeaderboardUseCase`). **La generación de preguntas IA YA NO
  cachea** (se eliminó para evitar duplicados/datos obsoletos).
- Autenticación: JWT + OAuth Google y Microsoft.
- Comunicación NestJS↔FastAPI: REST/HTTP (NO gRPC).
- Modelos Ollama configurables por env (`OLLAMA_QWEN_MODEL`, `OLLAMA_MISTRAL_MODEL`); las etiquetas UI son
  "Qwen3 8B"/"Mistral Nemo" pero el modelo real depende del entorno.
- PREVISTO (no implementado): Celery, colas Bull, Mailer/SMTP, WebSocket/SSE funcional.

Roles: ESTUDIANTE (USER), DOCENTE (TEACHER), ADMINISTRADOR (ADMIN).

### Módulos NestJS (7 reales)
- **ai (AiModule)** — AIClientService: ACL/Adapter/Facade → FastAPI (grade, generateFeedback, analyzeWeaknesses) con
  fallback local.
- **auth (AuthModule)** — login, register, oauth-login, refresh, logout, verify-email (STUB: token=userId, no usa la
  tabla), request-password-reset (real: token + log del enlace), reset-password.
- **quiz (QuizModule)** — create/get/list quiz (con filtros category/difficulty/publishedOnly + paginación
  page/limit), start/submit/end session, **generate-ai-questions**, list-my-history; generación IA vía
  **AIProviderFactory (Qwen/Mistral)** con **loop de relleno (top-up) + dedup + fallback**, **SIN Cache-Aside**.
- **score (ScoreModule)** — calculate/save score, check-achievements, **leaderboard (Cache-Aside 60s; admite filtro
  por periodo `months`=2/3/6/12 y por `section`)**, user-history (admite `months`); QuizCompletedListener.
- **users (UsersModule)** — get/update profile, user-history, delete-account; listado admin/estudiantes
  (paginado + filtro `role`, `search` y **`section`**); **endpoint `GET /users/sections`** (secciones distintas);
  CRUD admin de usuarios con campo **`section`**.
- **notifications (NotificationsModule)** — PARCIAL: solo entidad + BroadcastEvent (stub vacío); gateway WS y SSE
  controller son stubs vacíos (NO hay `@WebSocketGateway`).
- **feedback (FeedbackModule)** — PARCIAL: solo la entidad FeedbackIA (sin repo, sin use-cases, sin listener, sin
  caché).
- **NO existe MailerModule**.

### Entidades (11 tablas físicas — todas existen como @Entity TypeORM)
Existentes (7): `users`, `auth_sessions`, `quizzes`, `questions`, `quiz_sessions`, `scores`, `achievements`.
Nuevas por RF (4, color magenta): `email_verification_tokens`, `password_reset_tokens`, `notifications`,
`feedback_ia`.

Nota de estado: `password_reset_tokens` SÍ se usa; `email_verification_tokens` definida pero NO usada (VerifyEmail es
stub); `notifications` y `feedback_ia` tienen tabla pero su capa de aplicación NO está implementada (entidades sin
repo/escritura).

Subdoc embebido (no tabla): RESPUESTA = `SessionAnswer[]` en `quiz_sessions.answers` (jsonb)
`{questionId,userAnswer,isCorrect,score,timeTakenMs,answeredAt}`.

#### Atributos exactos
- **users**: id uuid PK; email varchar(320) UNIQUE; password_hash varchar(255); first_name/last_name varchar(80);
  role `users_role_enum{USER,TEACHER,ADMIN}` def USER; **section varchar(40) NULL** (grupo/sección escolar);
  is_active bool def true; is_email_verified bool def false; created_at/updated_at. UNIQUE(email); **idx(section)**.
- **auth_sessions**: id PK; user_id uuid (FK suave); refresh_token_hash varchar(255); user_agent varchar(255) NULL;
  ip_address varchar(64) NULL; expires_at timestamptz; is_revoked bool def false; created_at. idx(user_id).
- **email_verification_tokens / password_reset_tokens**: id PK; user_id uuid (FK suave); token_hash varchar(255)
  UNIQUE; expires_at timestamptz; used_at timestamptz NULL; created_at. idx(user_id), UNIQUE(token_hash),
  idx(expires_at). Métodos isExpired/isUsed/markUsed. (reset TTL 1h).
- **quizzes**: id PK; title varchar(160); description text NULL; category
  `quiz_category_enum{general,language,math,science,biology,physics,chemistry,history,geography,social_sciences,english,technology,art,custom}`
  def general; difficulty `quiz_difficulty_enum{easy,medium,hard}` def medium; language `quiz_language_enum{en,es}`
  def en; author_id uuid (FK suave); source varchar(32) def 'custom'; time_per_question_seconds int def 30;
  is_published bool def false; created_at/updated_at. idx(author_id, category, is_published, language).
  OneToMany questions.
- **questions**: id PK; quiz_id uuid FK→quizzes ON DELETE CASCADE (@ManyToOne, única FK dura); text text; type
  `questions_type_enum{multiple_choice,true_false,open_answer}` def multiple_choice; options jsonb NULL;
  correct_answer text; difficulty/language enum; position int def 0; time_limit_seconds int NULL; explanation text
  NULL; feedback text NULL. idx(quiz_id). (explanation/feedback se editan en UI y se muestran en detalle e historial.)
- **quiz_sessions**: id PK; user_id/quiz_id uuid (FK suave); status
  `quiz_sessions_status_enum{in_progress,completed,abandoned}` def in_progress; answers jsonb def '[]'; total_score
  float def 0; correct_count int def 0; started_at; completed_at timestamptz NULL. idx(user_id, quiz_id, status).
- **scores**: id PK; user_id/quiz_id/session_id uuid (FK suave); points float; correct_count int; total_questions int;
  accuracy float (DESNORMALIZADO); created_at. idx(user_id, quiz_id, created_at).
- **achievements**: id PK; user_id uuid (FK suave); code
  `achievements_code_enum{first_quiz,perfect_score,streak_3,streak_10,speed_demon,points_1000,points_5000}`; title
  varchar(160); description text NULL; unlocked_at. idx(user_id, code), UNIQUE(user_id, code).
- **notifications**: id PK; user_id uuid (FK suave); type
  `notification_type_enum{ACHIEVEMENT,SCORE,EMAIL_VERIFY,PASSWORD_RESET,QUIZ_PUBLISHED,LOGIN_DEVICE,SYSTEM}`; title
  varchar(255); body text; payload jsonb NULL; is_read bool def false; read_at timestamptz NULL; created_at.
  idx(user_id), idx COMPUESTO(user_id, is_read) [NO parcial], idx(created_at). markAsRead().
- **feedback_ia**: id PK; session_id/question_id/user_id uuid (FK suave); content text; suggestion text NULL; score
  float; is_correct bool (DESNORMALIZADO); confidence float NULL; model varchar(64); strategy_used
  `grading_strategy_enum{similarity,llm_rubric,exact_match}`; latency_ms int NULL; created_at.
  idx(session_id, question_id, user_id, created_at). Sin columna de estado/lifecycle.

### Patrones REALMENTE aplicados (rotular «pattern»)
Hexagonal (Ports & Adapters), Clean Architecture, DDD (bounded contexts: Auth, Users, Evaluación, IA, Gamificación;
Notificación y Feedback parciales), Microservicios (REST), BFF (Next.js `proxy.ts`), RAG (FAISS+LangChain+Ollama en
FastAPI), ACL/Adapter/Facade (AIClientService), Strategy (calificación abierta-IA vs cerrada-local; verificadores
OAuth; model_factory FastAPI), Factory (OAuthVerifierRegistry; **AIProviderFactory Qwen/Mistral**; model_factory),
Builder (PromptBuilder en FastAPI), Repository, Aggregate Root (User, Quiz, QuizSession), Value Object (Email, Role,
Category, Difficulty, Language, etc.), Entity, Domain Event (EventEmitter2), State (quiz_sessions.status;
auth_sessions is_revoked/expires_at; tokens used_at/expires_at; notifications is_read), DTO, Decorator
(@Injectable/@UseGuards/@Roles/@Public/Guards/Interceptors), Singleton (servicios scope default), Composite (Quiz ◆──
Questions), **Cache-Aside (SOLO en leaderboard — score module, TTL 60s)**, Idempotency Key (token_hash UNIQUE +
used_at; SubmitAnswer rechaza doble respuesta), Resiliencia/Fallback (AIClient cae a exact-match local; AIProviderFactory
degrada Qwen→Mistral), **Top-up/Retry acotado + Dedup (generación de preguntas hasta alcanzar la cantidad pedida,
máx. 3 intentos)**, **Lenient Parser (parser JSON tolerante: ignora `<think>`, objeto único, objetos sueltos)**,
**Quality Gate (rechazo de placeholders tipo "Opción A" y de preguntas inválidas)**.

### Patrones PREVISTOS / NO implementados (marcar como tales si se muestran)
Circuit Breaker formal, Saga formal con compensación, Outbox, Mailer/Adapter SMTP, Proxy/Cache de feedback_ia
(findCachedByQuestionAndAnswer), CQRS-lite estricto, Mediator, Retry-with-Backoff (Celery/Bull), Observer hacia
notifications/WS, Pub/Sub WebSocket.

### Eventos de dominio (8 reales, EventEmitter2)
UserLoggedInEvent, UserRegisteredEvent, QuizCompletedEvent, QuizCreatedEvent, QuizStartedEvent,
AchievementUnlockedEvent, ScoreUpdatedEvent, ProfileUpdatedEvent.
NO existen: AnswerSubmittedEvent, FeedbackPersistedEvent, NotificationCreatedEvent, EmailVerificationRequestedEvent,
PasswordResetRequestedEvent.

### Listeners (1 real)
QuizCompletedListener (módulo score) → SaveScore + CheckAchievements. NO existen AchievementUnlockedListener /
AnswerSubmittedListener / UserRegisteredListener ni listeners @OnEvent de notifications.

### Puertos (interfaces de dominio reales)
IUserRepository (incluye `listAll` con filtro section + `listSections`), IAuthRepository,
IPasswordResetTokenRepository, ITokenService, IOAuthVerifier, IQuizRepository, IScoreRepository (`getLeaderboard` con
`since`/`section`; `findByUser` con `since`), IAchievementRepository, notification.interface, IAiQuestionProvider.
NO existen: IFeedbackIaRepo, INotificationRepo (persistencia), IEmailVerificationTokenRepo separado.

### Repositorios infra TypeORM (reales)
auth.repository, password-reset-token.repository, quiz.repository, achievement.repository, score.repository
(filtros de fecha/sección), user.repository (filtro section + listSections). (No hay repo de notification, feedback_ia
ni email-verification-token.)

### Microservicio FastAPI (hexagonal, 4 módulos)
grading (grade_answer/batch_grade/generate_rubric; exact_match/similarity/nlp + model_factory Strategy;
`/api/v1/grading/grade`), feedback (generate_feedback/analyze_weaknesses/recommendation/study_plan; ollama_client +
rag_retriever + faiss_store; `/api/v1/feedback/generate`, `/weaknesses`), analytics
(classify_difficulty/detect_anomalies), assistant (chat_with_agent/get_conversation; tutor_agent LangChain + FAISS +
conversation_repo).

### Dos rutas de IA (no confundir)
1. **Generación de preguntas (quiz.module):** AIProviderFactory (Factory) + QwenProvider/MistralProvider (HTTP a
   Ollama) + **loop top-up + dedup + parser tolerante + Quality Gate + fallback Qwen→Mistral**. **SIN Cache-Aside**.
   NO pasa por FastAPI ni Open Trivia (Open Trivia fue eliminado del proyecto). Soporta tipos multiple_choice,
   true_false y open_answer.
2. **Calificación y feedback (ai.module):** AIClientService (ACL) → FastAPI. Fallback local exact-match.

### Funcionalidad analítica (Implementada — reflejar en casos de uso / clases / componentes)
- **Filtro por periodo** (2/3/6/12 meses) en leaderboard e historiales (param `months`); util `period.util`
  (`parsePeriodMonths`, `monthsToSince`). El recorte de sesiones detalladas se hace en el cliente; el de
  scores/leaderboard en SQL (`createdAt`).
- **Sección**: `users.section` + filtro en listados + `GET /users/sections`. (En la UI el filtro visible quedó solo
  por periodo + botón "Filtrar"; el filtro por sección a nivel datos/endpoint existe pero NO se expone en la UI de
  dashboards.)
- **Leaderboard**: visible solo para DOCENTE/ADMIN (embebido en `/teacher/students`), no para el estudiante.
- **Paginación** en tablas (frontend).

### Requisitos generales de estilo
- Cada diagrama independiente, profesional, limpio. Nombres en español. Cardinalidades explícitas. Coherencia entre
  todos.
- Colores: Dominio verde claro · Aplicación naranja claro · Infraestructura azul claro · Presentación rosa claro ·
  Patrones amarillo claro · Tablas/módulos NUEVOS por RF magenta claro.
- Cada patrón rotulado con estereotipo «Strategy», «Adapter», «Repository», etc.
- Distinguir lo existente en código (7 tablas + módulos base) vs nuevo por RF (4 tablas + módulos
  feedback/notifications parciales). Marcar STUB/PARCIAL/PREVISTO donde aplique.

### Diagramas a generar/actualizar (10)
1. **DER (Crow's Foot)** — 11 tablas, PK/FK diferenciadas, cardinalidades. FK suave (uuid sin @ManyToOne) entre
   bounded contexts; ON DELETE CASCADE SOLO en questions→quizzes. Incluir **users.section**. Marcar
   accuracy/options/answers/is_correct como notas de desnormalización.
2. **Modelo Relacional PostgreSQL** — tipos reales, índices @Index, UNIQUE, ENUMs nativos (users_role_enum,
   **quiz_category_enum con 14 valores académicos**, quiz_difficulty_enum, quiz_language_enum, questions_type_enum,
   quiz_sessions_status_enum, achievements_code_enum, notification_type_enum, grading_strategy_enum), JSONB, UUID.
   Incluir **idx(users.section)**. notifications con índice COMPUESTO(user_id,is_read) — NO parcial. UNIQUE token_hash
   en tokens.
3. **Normalización** — 1FN/2FN/3FN/BCNF + matriz de las 11 tablas + 5 desnormalizaciones controladas: scores.accuracy,
   questions.language, quiz_sessions.answers(JSONB), questions.options(JSONB), feedback_ia.is_correct.
4. **Clases UML** (hexagonal: Dominio/Aplicación/Infraestructura/Presentación) — 11 entidades con métodos reales
   (tokens: isExpired/isUsed/markUsed; Notification: markAsRead). Use-cases reales por módulo, puertos reales, 6 repos
   reales (user.repository con `listSections`; score.repository con filtros de fecha/sección), AIClientService
   (Adapter/Facade/ACL), **AIProviderFactory + Qwen/Mistral (con top-up + parser tolerante, SIN caché)**,
   JwtTokenService, **GetLeaderboardUseCase (Cache-Aside 60s, params months/section)**. NO incluir Mailer, use-cases de
   Feedback, use-cases extra de Notifications, ni listeners/eventos/puertos inexistentes (o marcarlos «PREVISTO»).
   FeedbackIA y Notification solo como Entity.
   por favor que el diagramas las entidades sean como tablas que se puedan visualizar sus atributos y acceso y metodosos con sus operaciones el tipo de relación y cardinalidas esta pagina web como referencia https://diagramasuml.com/diagrama-de-clases/, https://mododebug.com/uml-diagramas-clases/,
   https://www.cybermedian.com/es/mastering-the-uml-class-diagram-syntax-and-examples/
5. **Casos de Uso** — actores: Estudiante, Docente, Administrador, Sistema OAuth (Google/Microsoft), Servicio IA
   (FastAPI). SIN Open Trivia DB ni SMTP. Use-cases reales (registro, login, OAuth, refresh, logout,
   verify-email[stub], solicitar/restablecer contraseña, perfil CRUD, crear/generar-IA/listar/obtener quiz,
   start/submit/end session, leaderboard [docente/admin, con filtro periodo], historial [con filtro periodo], logros,
   analizar debilidades, **gestionar usuarios + sección [admin]**, **listar secciones**). NO incluir CRUD de
   notificaciones persistentes, feedback histórico, ni cron de tokens (o marcar «PREVISTO»). include/extend solo entre
   casos reales.
6. **Secuencias — Login OAuth y Resolver evaluación con IA.** Lifelines: Next.js/Auth.js, NestJS, FastAPI, PostgreSQL.
   Login OAuth: Auth.js→/auth/oauth→OAuthLoginUseCase→IOAuthVerifier(Strategy)→upsert user→crea
   auth_session→JwtTokenService→emit UserLoggedInEvent (SIN notificación ni WS). Resolver quiz: SubmitAnswerUseCase con
   Strategy (abierta→AIClient.grade FastAPI con fallback local; cerrada→exact-match local)→append a answers(jsonb);
   feedback si incorrecta (question.feedback o AIClient.generateFeedback). SIN cache ni INSERT feedback_ia. EndSession
   (orquestación, no Saga formal): finaliza
   quiz_sessions→QuizCompletedEvent→QuizCompletedListener→SaveScore+CheckAchievements (SIN notifications/WS).
   (Opcional: secuencia de **Generar preguntas IA**: AIProviderFactory→QwenProvider/MistralProvider(HTTP Ollama)→parser
   tolerante→Quality Gate→loop top-up hasta N→append al formulario, SIN caché.)
7. **Arquitectura Microservicios** — Frontend Next.js (BFF proxy), Backend NestJS (7 módulos; notifications y feedback
   marcados PARCIAL/stub), FastAPI (grading/feedback/analytics/assistant), PostgreSQL (11 tablas), Redis (**Cache-Aside
   solo leaderboard**; Bull PREVISTO), OAuth providers, Ollama. SIN SMTP, SIN Mailer, SIN Open Trivia. Mostrar las 2
   rutas de IA (generación SIN caché; calificación vía FastAPI). Patrones por contenedor: BFF, ACL, RAG, Adapter,
   Pub/Sub in-process.
   mejore mucho la visualización de este diagrama de Microservicios que sea muy porfesional
8. **Estados** — máquinas respaldadas por columnas reales: quiz_sessions.status (in_progress→completed|abandoned);
   auth_sessions (ACTIVA→REVOCADA|EXPIRADA; sin estado "refrescada" persistido — la rotación crea fila nueva, indicar
   con nota); email_verification_tokens y password_reset_tokens (ACTIVO→USADO|EXPIRADO vía used_at/expires_at);
   notifications (NO_LEIDA→LEIDA vía markAsRead; SIN ENTREGADA_WS/ARCHIVADA). feedback_ia: SIN máquina de estados (sin
   columna status) — incluir nota explicativa. Estereotipo «State».
9. **Estados — subsistema de autenticación.** Flujo OAuth (Auth.js→bridge→NestJS):
   UNAUTHENTICATED→REDIRECTING_OAUTH→AWAITING_CONSENT→CALLBACK→VERIFYING_TOKEN→SESSION_CREATED→AUTHENTICATED. Flujo
   Verify Email: estado real = VerifyEmail es STUB (set is_email_verified=true sin token real); marcar el envío de email
   y el uso de email_verification_tokens como «PREVISTO». Flujo Password Reset: RESET_REQUESTED→TOKEN_GENERATED
   (password_reset_tokens, TTL 1h)→[envío de email PREVISTO; hoy se registra el enlace en
   log]→TOKEN_PRESENTED→PASSWORD_UPDATED. Notas con use-cases y tablas que cambian.
10. **Componentes** — 7 módulos NestJS con 4 capas (sin MailerModule); 11 tablas mapeadas a módulos; AIClientService
    como ACL→FastAPI; **AIProviderFactory + Qwen/Mistral SIN Cache-Aside** en quiz/infrastructure; **Cache-Aside SOLO en
    score/GetLeaderboardUseCase**; EventEmitter2 con único listener real QuizCompletedListener (en score); Redis caché
    (Bull PREVISTO). Marcar WS client/SSE/NotificationsGateway, FeedbackIaRepository+cache, y MailerService→SMTP como
    «PREVISTO / no implementado».

### Resultado esperado
Arquitectura profesional, consistente y apta para sustentación universitaria, coherente con Hexagonal, Clean
Architecture, DDD, OAuth 2.0, JWT, microservicios REST, RAG, PostgreSQL/Redis. Cada patrón rotulado en el diagrama que
corresponda. Distinguir claramente Implementado vs PARCIAL/STUB vs PREVISTO. No simplifiques los diagramas.

---

## Cambios de auditoría vs prompt anterior

Correcciones aplicadas tras auditar el código (con referencia al archivo fuente):

1. **`quiz_category_enum` ahora es académico (14 valores)** — `general, language, math, science, biology, physics,
   chemistry, history, geography, social_sciences, english, technology, art, custom`. Se **eliminaron** `sports` y
   `entertainment`. Afecta diagramas 1, 2, 5. Fuente: `apps/backend/src/modules/quiz/domain/value-objects/category.vo.ts`.
2. **Nueva columna `users.section varchar(40) NULL` + `idx(section)`** — sección/grupo escolar. Afecta diagramas 1, 2,
   4. Fuente: `apps/backend/src/modules/users/domain/entities/user.entity.ts`.
3. **Cache-Aside reubicado** — ya **NO** está en la generación de preguntas IA (se eliminó la caché para evitar
   duplicados/datos viejos). El único Cache-Aside real es el **leaderboard** (`GetLeaderboardUseCase`, TTL 60s, clave
   por limit+months+section). TTL del sistema corregido de "60s–1h" a **60s**. Afecta diagramas 4, 7, 10. Fuentes:
   `score/application/use-cases/get-leaderboard.use-case.ts`, `quiz/application/use-cases/generate-ai-questions.use-case.ts`
   (sin CACHE_MANAGER).
4. **Generación de preguntas con loop top-up + dedup + parser tolerante + Quality Gate** — patrones nuevos a rotular:
   *Top-up/Retry acotado*, *Dedup*, *Lenient Parser* (ignora `<think>`, objeto único, objetos sueltos), *Quality Gate*
   (rechazo de "Opción A"/placeholders). Fuentes: `generate-ai-questions.use-case.ts`,
   `quiz/infrastructure/clients/base-ollama-ai.provider.ts`, `factories/ai-provider.factory.ts`.
5. **`IScoreRepository` y `IUserRepository` ampliados** — `getLeaderboard(limit, since?, section?)`,
   `findByUser(userId, limit, since?)`, `listAll(... section?)`, `listSections()`. Nuevo endpoint
   `GET /users/sections`. Filtro por periodo (`months`=2/3/6/12) en leaderboard e historiales; util
   `shared/utils/period.util.ts`. Afecta diagramas 4, 5, 10.
6. **Leaderboard restringido a DOCENTE/ADMIN** (embebido en `/teacher/students`, fuera del perfil del estudiante).
   Afecta diagrama 5 (actor/visibilidad).
7. **`questions.type` incluye `open_answer`** (ya en enum) y `explanation`/`feedback` se usan en UI (editar examen,
   detalle, historial por-pregunta). Sin cambio de esquema; aclaración para diagramas 4 y 6.
8. Se mantienen como **PREVISTO/STUB/PARCIAL**: Mailer/SMTP, Bull/Celery, WebSocket/SSE, gRPC, Open Trivia (eliminado),
   caché de `feedback_ia`, listeners/eventos/puertos inexistentes, Circuit Breaker/Saga/Outbox formales.

### Notas de verificación (estado del repositorio)
- Caché efectiva: confirmada solo en `get-leaderboard.use-case.ts` (`@Inject(CACHE_MANAGER)`).
- `category.vo.ts`: 14 valores académicos confirmados.
- `user.entity.ts`: `section?: string | null` con `@Index()` confirmado.
- Carpeta de diagramas: `Documents\proyectoBorrador\neuroeducativo-app-diagrams/` con los 10 archivos `01..10`.
- `synchronize=true` en dev: aplicar `users.section` y el enum de categorías requiere reiniciar backend (y, para el
  enum, que no existan filas con `sports`/`entertainment`).
