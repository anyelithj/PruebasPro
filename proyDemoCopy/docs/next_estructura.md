# Next.js 16 — Estructura de Carpetas

## Tipo de Arquitectura

**MVC + Clean Architecture + Atomic Design + BFF (Backend for Frontend)**

| Capa MVC        | Implementación en Next.js                                                                               |
|-----------------|--------------------------------------------------------------------------------------------------------|
| **Model**       | Redux slices + RTK Query (estado y datos) · Zod schemas · Tipos TypeScript (Clean Arch: domain types) |
| **View**        | `app/` pages (RSC/CSR) + `components/` Atomic Design: atoms → molecules → organisms → templates        |
| **Controller**  | `app/api/` Route Handlers (BFF) · `middleware.ts` (rutas protegidas) · Custom Hooks                   |
| **Lógica**      | Custom Hooks + Store slices + RTK Query (Clean Architecture: application layer)                         |
| **Persistencia**| RTK Query cache + NextAuth session + localStorage type-safe                                             |

**Capas Clean Architecture en el Frontend:**
- **Domain**: tipos TypeScript, Zod schemas, interfaces de repositorio (RTK Query endpoints)
- **Application**: Custom Hooks, Store slices, casos de uso del cliente
- **Infrastructure**: RTK Query (fetch), NextAuth, fetch (api-client.ts), localStorage
- **Presentation**: `app/` pages + `components/` (Atomic Design)

**Patrones GoF y Arquitectónicos:** Container/Presentational · Error Boundary · Observer (RTK Query/SSE) · Proxy (API routes BFF) · Null Object (EmptyState) · Memento (Redux DevTools) · State (quizSlice) · Decorator (Metadata API) · Adapter (NextAuth providers) · Composite (shadcn/ui)

**Patrones React (patterns.dev):**
- **HOC Pattern**: `withAuth()`, `withRoles()` — comportamiento transversal sin modificar componentes
- **Hooks Pattern**: `useTimer`, `useAuth`, `useQuiz`, `useSSE`, `useDebounce` — lógica reutilizable extraída
- **Compound Pattern**: `QuizCard.Root + QuizCard.Header + QuizCard.Body` — estado compartido sin prop drilling
- **Container/Presentational**: `QuizListContainer` (datos) → `QuizGrid` (visual); `AuthContainer` → `LoginForm`
- **Render Props Pattern**: `<Timer render={(time) => <TimerBar value={time} />} />` — reutilizar lógica con distintas UIs

**Patrones de Renderizado (Next.js 16):**
- **CSR** (Client-Side Rendering): quiz activo, chat IA, formularios interactivos
- **SSR** (Server-Side Rendering): dashboard, perfil, listado de quizzes, resultados
- **SSG** (Static Rendering): landing page, términos, páginas de error
- **ISR** (Incremental Static Generation): leaderboard (revalidate: 60s), categorías
- **Progressive Hydration**: componentes pesados (WeaknessChart, AssistantChat)
- **Streaming SSR**: layout con Suspense boundaries; partes se envían en stream
- **React Server Components (RSC)**: Navbar, Footer, PageHeader, LeaderboardTable
- **Selective Hydration**: `'use client'` solo donde hay interactividad real

**AI UI Patterns y React Stack 2026:**
- **Streaming Response**: la campana del portal recibe avisos en tiempo real vía SSE (useSSE)
- **Optimistic Updates**: mensaje del usuario aparece antes de respuesta IA
- **Server Actions**: mutaciones de formulario sin Route Handler explícita
- **Partial Prerendering**: shell estático instantáneo + partes dinámicas en stream
- **use() hook**: lectura de Promises en RSC sin useEffect
- **useTransition**: navegación entre preguntas sin bloquear la UI

**Paradigmas:** Declarativo (JSX) · Funcional (hooks/funciones puras) · Reactivo (RTK Query/SSE) · Async/Await · Orientado a Eventos (Redux)

**Prácticas:** SOLID · DRY · Clean Code · Type-Safe (TS strict + Zod) · SEO (Metadata API + sitemap.ts + JSON-LD) · A11y (WCAG 2.1 AA) · Responsive (Tailwind breakpoints) · SSR/SSG · Rutas públicas/protegidas (`middleware.ts` + NextAuth)

**Tecnologías:** Next.js 16 · React 19 · TypeScript 5 · Redux Toolkit 2 · Tailwind CSS 4 · tw-animate-css · shadcn/ui · Radix UI · Zod · React Hook Form · NextAuth.js · Playwright · Jest · MSW · ESLint · Prettier

**Nota — MCP (Model Context Protocol):** El frontend Next.js 16 puede consumir herramientas expuestas por el AI Service (FastAPI) a través del protocolo MCP. MCP es un protocolo JSON-RPC 2.0 sobre HTTP/SSE definido por Anthropic para la comunicación entre agentes IA y clientes. En este proyecto el componente `AssistantChat.tsx` consume las `tools[]` del agente tutor vía el endpoint MCP del AI Service, con autenticación JWT.

**Nota — JSON:API:** JSON:API NO es un protocolo de API ni de comunicación. Es una convención de formato de respuesta REST (especificación jsonapi.org). Las respuestas del backend NestJS siguen un envelope `{ data, meta, errors }` compatible con JSON:API 1.1, procesado por RTK Query en el frontend.

---

## Estructura de Carpetas Completa

> Árbol generado desde la matriz `matriz_trazabilidad_tecnica_AulaDeIdiomas (6).xlsx` (hoja «📱 Next.js 16», columna «Carpeta / Archivo (FBA)»): ambos documentos listan los mismos archivos con los mismos nombres. La etiqueta `[CREAR | LISTAR | VER DETALLE | EDITAR | ELIMINAR]` indica qué operación CRUD atiende cada archivo; en la matriz no se repiten las carpetas porque ya aparecen en la ruta de cada archivo.

```
apps/frontend-next/                                       # MVC + Clean Architecture + Atomic Design: View=app/ · Controller=api/+hooks · Model=store/ · Infra=lib/
├── src/                                        # Código fuente de la aplicación
│   ├── app/                                    # App Router — capa Presentación
│   │   ├── (auth)/                             # Grupo rutas públicas (sin auth)
│   │   │   ├── forgot-password/                # Segmento de ruta (auth)/forgot-password — SOLICITAR la recuperación de contraseña (ForgotPasswordForm)
│   │   │   │   └── page.tsx                    # SOLICITAR la recuperación de contraseña (ForgotPasswordForm)
│   │   │   ├── login/                          # Segmento de ruta (auth)/login — INICIAR SESIÓN (LoginForm: correo/contraseña, OAuth y enlace mágico)
│   │   │   │   ├── loading.tsx                 # Skeleton SSR mientras carga
│   │   │   │   ├── oauth-actions.ts            # RPC tipado al backend
│   │   │   │   └── page.tsx                    # Login: SSR + redirect si ya auth + generateMetadata
│   │   │   ├── register/                       # Segmento de ruta (auth)/register — CREAR una cuenta (RegisterForm multipaso, formulario en blanco)
│   │   │   │   ├── loading.tsx                 # Loading auth: spinner mínimo
│   │   │   │   └── page.tsx                    # [CREAR] Registro: multi-step + Zod + RHF
│   │   │   ├── reset-password/                 # Segmento de ruta (auth)/reset-password — EDITAR la contraseña con el token recibido (ResetPasswordForm)
│   │   │   │   └── page.tsx                    # [EDITAR] EDITAR la contraseña con el token recibido (ResetPasswordForm)
│   │   │   ├── terms/                          # Segmento de ruta (auth)/terms — VER términos y condiciones (estático, solo lectura)
│   │   │   │   └── page.tsx                    # [VER DETALLE] Términos: SSG estático
│   │   │   ├── verify-email/                   # Segmento de ruta (auth)/verify-email — VERIFICAR el correo con el token recibido (VerifyEmailForm)
│   │   │   │   └── page.tsx                    # VERIFICAR el correo con el token recibido (VerifyEmailForm)
│   │   │   ├── layout.tsx                      # Layout público: navbar mínimo + SEO base
│   │   │   └── page.tsx                        # Landing: SSG + generateMetadata SEO + JSON-LD · ℹ definido en next_estructura.md; no existe en el código
│   │   ├── (portal)/                           # Grupo rutas protegidas (requieren JWT)
│   │   │   ├── admin/
│   │   │   │   ├── activities/         # Segmento de ruta (portal)/admin/activities — pestaña «Actividades» de Gestión (2026-10-19)
│   │   │   │   │   └── page.tsx        # [LISTAR] accesos para administrar práctica, música, diálogos, poliglota, gramática y juegos
│   │   │   │   ├── courses/                    # Segmento de ruta (portal)/admin/courses — LISTAR cursos de gestión (tabla con acciones por fila: editar, publicar, eliminar)
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── edit/               # Segmento de ruta (portal)/admin/courses/[id]/edit — EDITAR un curso (CourseForm mode="edit", cargado con sus datos)
│   │   │   │   │   │       └── page.tsx        # [EDITAR] EDITAR: carga el curso por id en el servidor y monta CourseForm mode="edit"
│   │   │   │   │   ├── new/                    # Segmento de ruta (portal)/admin/courses/new — CREAR un curso (CourseForm mode="create", formulario en blanco)
│   │   │   │   │   │   └── page.tsx            # [CREAR] CREAR: monta CourseForm mode="create" (vacío)
│   │   │   │   │   ├── actions.ts              # [CREAR, EDITAR, ELIMINAR] createCourseAction · updateCourseAction · deleteCourseAction · setPublishedAction (CREAR / EDITAR / ELIMINAR) + revalidatePath
│   │   │   │   │   ├── CourseForm.tsx          # [CREAR, VER DETALLE, EDITAR] Formulario ÚNICO de curso (DRY): mode="create" = en blanco · mode="edit" = cargado con los datos · mode="view" = solo lectura. Las páginas new/, [id]/ y [id]/edit/ solo cargan los datos y eligen el modo; el envío va a la Server Action del módulo (createCourseAction / updateCourseAction)
│   │   │   │   │   └── page.tsx                # [LISTAR] LISTAR: tabla de cursos de gestión con acciones por fila (editar, publicar, eliminar)
│   │   │   │   ├── curriculum/                 # Segmento de ruta (portal)/admin/curriculum — LISTAR recursos de gestión con filtros y acciones por fila (ver, editar, cambiar estado, eliminar)
│   │   │   │   │   ├── [id]/                   # Segmento de ruta (portal)/admin/curriculum/[id] — VER DETALLE de un recurso (CurriculumItemForm mode="view": vista previa, revisiones y traza IA) + ELIMINAR
│   │   │   │   │   │   ├── edit/               # Segmento de ruta (portal)/admin/curriculum/[id]/edit — EDITAR un recurso (CurriculumItemForm mode="edit", cargado con sus datos)
│   │   │   │   │   │   │   └── page.tsx        # [EDITAR] EDITAR: carga el recurso por id en el servidor y monta CurriculumItemForm mode="edit"
│   │   │   │   │   │   └── page.tsx            # [VER DETALLE] VER DETALLE: carga el recurso por id (getCurriculumItem) y monta CurriculumItemForm mode="view" con vista previa, revisiones y traza IA; botón ELIMINAR (deleteResourceAction)
│   │   │   │   │   ├── new/                    # Segmento de ruta (portal)/admin/curriculum/new — CREAR un recurso (CurriculumItemForm mode="create", formulario en blanco)
│   │   │   │   │   │   └── page.tsx            # [CREAR] CREAR: monta CurriculumItemForm mode="create" (vacío)
│   │   │   │   │   ├── tema/                   # Segmento de ruta (portal)/admin/curriculum/tema — VER DETALLE de un TEMA completo (todos sus elementos) + ELIMINAR el tema
│   │   │   │   │   │   ├── editar/             # Segmento de ruta (portal)/admin/curriculum/tema/editar — EDITAR un TEMA completo (CurriculumItemForm mode="edit" por elemento; se pueden AÑADIR más a mano o con IA)
│   │   │   │   │   │   │   └── page.tsx        # [EDITAR] EDITAR un TEMA completo: los elementos existentes se cargan en CurriculumItemForm mode="edit" y se pueden AÑADIR más (a mano o con IA)
│   │   │   │   │   │   └── page.tsx            # [VER DETALLE] VER DETALLE de un TEMA (tema + idioma + nivel + tipo) con todos sus elementos desplegados; acciones del tema completo y de cada elemento
│   │   │   │   │   ├── actions.ts              # [CREAR, EDITAR, ELIMINAR] createResourceAction · updateResourceAction · deleteResourceAction (CREAR / EDITAR / ELIMINAR) y cambio de estado de revisión (borrador → revisión → aprobado)
│   │   │   │   │   └── page.tsx                # [LISTAR] LISTAR: tabla de recursos con filtros, cambio de estado y eliminar
│   │   │   │   ├── jobs/                       # Segmento de ruta (portal)/admin/jobs — LISTAR trabajos programados, VER el detalle de uno y EJECUTARLO bajo demanda (solo ADMIN)
│   │   │   │   │   ├── actions.ts              # [LISTAR, VER DETALLE, EDITAR] runJobAction(name): POST /admin/jobs/:name/run + revalidatePath
│   │   │   │   │   ├── RunJobButton.tsx        # [EDITAR] «Ejecutar ahora» con useActionState (React 19) y resultado en role="status"
│   │   │   │   │   └── page.tsx                # [LISTAR, VER DETALLE] Trabajos programados: estado de colas y últimos trabajos; fila expandible con el detalle (consume NestJS /admin/jobs)
│   │   │   │   ├── reports/                    # Segmento de ruta (portal)/admin/reports — VER reportes ADMIN (solo lectura, filtro por periodo)
│   │   │   │   │   ├── page.tsx                # [VER DETALLE] Reportes ADMIN: usuarios por rol, exámenes por categoría y dificultad, promedios y ranking del periodo (carga en paralelo en el servidor)
│   │   │   │   │   └── ReportsClient.tsx       # Gráficas interactivas de los reportes (ChartBars, Donut)
│   │   │   │   └── users/                      # Segmento de ruta (portal)/admin/users — LISTAR usuarios (tabla con acciones por fila: ver, editar, desactivar)
│   │   │   │       ├── [id]/                   # Segmento de ruta (portal)/admin/users/[id] — VER DETALLE de un usuario (UserForm mode="view", solo lectura) + DESACTIVAR
│   │   │   │       │   ├── edit/               # Segmento de ruta (portal)/admin/users/[id]/edit — EDITAR un usuario (UserForm mode="edit", cargado con sus datos)
│   │   │   │       │   │   └── page.tsx        # [EDITAR] EDITAR: carga el usuario por id en el servidor y monta UserForm mode="edit"
│   │   │   │       │   └── page.tsx            # [VER DETALLE] VER DETALLE: carga el usuario por id (getUser) y monta UserForm mode="view" + DeactivateUserButton
│   │   │   │       ├── new/                    # Segmento de ruta (portal)/admin/users/new — CREAR un usuario (UserForm mode="create", formulario en blanco)
│   │   │   │       │   └── page.tsx            # [CREAR] CREAR: monta UserForm mode="create" (vacío)
│   │   │   │       ├── page.tsx                # [LISTAR] LISTAR: carga los usuarios en el servidor + RowActions (ver, editar, desactivar)
│   │   │   │       └── UserForm.tsx            # [CREAR, VER DETALLE, EDITAR] Formulario ÚNICO de usuario (DRY): mode="create" = en blanco · mode="edit" = cargado con los datos · mode="view" = solo lectura. Las páginas new/, [id]/ y [id]/edit/ solo cargan los datos y eligen el modo; el envío va a la Server Action del módulo (createUserAction / updateUserAction)
│   │   │   ├── assistant/                      # Segmento de ruta (portal)/assistant — CREAR una consulta puntual al tutor IA (pregunta/respuesta → feedback)
│   │   │   │   └── page.tsx                    # [CREAR] Feedback puntual del tutor IA: formulario pregunta/respuesta → /api/ai/feedback (no es el chat conversacional)
│   │   │   ├── courses/                        # Segmento de ruta (portal)/courses — LISTAR el catálogo de cursos del estudiante (tarjetas con filtros, solo lectura)
│   │   │   │   ├── [id]/                       # Segmento de ruta (portal)/courses/[id] — VER DETALLE de un curso: temario, materiales y compra/inscripción
│   │   │   │   │   ├── lessons/
│   │   │   │   │   │   └── [materialId]/       # Segmento de ruta (portal)/courses/[id]/lessons/[materialId] — VER DETALLE de una lección o material (lector PDF y audio, solo lectura)
│   │   │   │   │   │       └── page.tsx        # [VER DETALLE] VER DETALLE de una lección o material (lector PDF y audio, solo lectura)
│   │   │   │   │   ├── loading.tsx             # Loading skeleton /courses/:id: placeholder hero + descripción mientras SSR carga
│   │   │   │   │   └── page.tsx                # [VER DETALLE] VER DETALLE de un curso: temario, materiales y compra/inscripción
│   │   │   │   ├── loading.tsx                 # Loading skeleton /courses: placeholder de carga con grid de cards
│   │   │   │   └── page.tsx                    # [LISTAR] LISTAR el catálogo de cursos del estudiante (tarjetas con filtros, solo lectura)
│   │   │   ├── dashboard/                      # Segmento de ruta (portal)/dashboard — REDIRIGIR al dashboard del rol (sin interfaz propia)
│   │   │   │   ├── admin/                      # Segmento de ruta (portal)/dashboard/admin — VER KPIs del ADMIN (solo lectura)
│   │   │   │   │   └── page.tsx                # [VER DETALLE] Dashboard ADMIN: usuarios, exámenes, ranking y usuarios recientes (filtro por periodo)
│   │   │   │   ├── docente/                    # Segmento de ruta (portal)/dashboard/docente — VER KPIs del DOCENTE (solo lectura)
│   │   │   │   │   └── page.tsx                # [VER DETALLE] Dashboard DOCENTE: progreso de sus estudiantes y exámenes
│   │   │   │   ├── estudiante/                 # Segmento de ruta (portal)/dashboard/estudiante — VER KPIs del ESTUDIANTE (solo lectura)
│   │   │   │   │   └── page.tsx                # [VER DETALLE] Dashboard ESTUDIANTE: puntaje, progreso y próximos pasos
│   │   │   │   ├── loading.tsx                 # Skeleton dashboard
│   │   │   │   └── page.tsx                    # Redirige al dashboard según el rol del usuario
│   │   │   ├── feedback/                       # Segmento de ruta (portal)/feedback — VER la retroalimentación IA del estudiante (solo lectura)
│   │   │   │   └── page.tsx                    # [VER DETALLE] VER la retroalimentación IA del estudiante (solo lectura)
│   │   │   ├── leaderboard/                    # Segmento de ruta (portal)/leaderboard — VER el ranking (solo lectura, ISR 60 s)
│   │   │   │   ├── loading.tsx                 # Loading skeleton: spinner mínimo
│   │   │   │   └── page.tsx                    # [VER DETALLE] VER el ranking (solo lectura, ISR 60 s)
│   │   │   ├── profile/                        # Segmento de ruta (portal)/profile — VER DETALLE del perfil propio: progreso y puntaje (solo lectura)
│   │   │   │   ├── [username]/                 # Segmento de ruta (portal)/profile/[username] — VER DETALLE del perfil público de otro usuario (solo lectura)
│   │   │   │   │   └── page.tsx                # [VER DETALLE] VER DETALLE del perfil público de otro usuario (solo lectura)
│   │   │   │   ├── edit/                       # Segmento de ruta (portal)/profile/edit — EDITAR el perfil propio (ProfileEditForm mode="edit" + AvatarCard)
│   │   │   │   │   ├── actions.ts              # [CREAR, EDITAR] updateProfileAction · uploadAvatarAction (EDITAR) + revalidatePath
│   │   │   │   │   ├── AvatarCard.tsx          # AvatarCard
│   │   │   │   │   ├── page.tsx                # [EDITAR] EDITAR: carga el perfil propio y monta ProfileEditForm mode="edit" + AvatarCard
│   │   │   │   │   └── ProfileEditForm.tsx     # [VER DETALLE, EDITAR] Formulario de perfil (DRY): mode="edit" desde profile/edit; mode="view" reutilizable en el perfil público; envía a updateProfileAction (actions.ts)
│   │   │   │   ├── page.tsx                    # Perfil propio: SSR
│   │   │   │   └── ProgressClient.tsx          # ProgressClient
│   │   │   ├── quiz/                           # Segmento de ruta (portal)/quiz — LISTAR exámenes (tarjetas con filtros en la URL)
│   │   │   │   ├── [id]/                       # Segmento de ruta (portal)/quiz/[id] — VER DETALLE de un examen (solo lectura) + acciones según rol: jugar, editar, eliminar
│   │   │   │   │   ├── edit/                   # Segmento de ruta (portal)/quiz/[id]/edit — EDITAR un examen (QuizForm mode="edit", cargado con sus datos)
│   │   │   │   │   │   └── page.tsx            # [EDITAR] EDITAR: carga el examen por id en el servidor y monta QuizForm mode="edit"
│   │   │   │   │   ├── play/                   # Segmento de ruta (portal)/quiz/[id]/play — RESPONDER el examen (sesión activa con temporizador)
│   │   │   │   │   │   ├── page.tsx            # Jugar: Client Component + timer + Redux quizSlice
│   │   │   │   │   │   └── QuizPlayClient.tsx  # QuizPlayClient
│   │   │   │   │   ├── results/                # Segmento de ruta (portal)/quiz/[id]/results — VER RESULTADOS de la sesión: puntaje y feedback IA (solo lectura)
│   │   │   │   │   │   └── page.tsx            # [VER DETALLE] Resultados: SSR + feedback IA + score
│   │   │   │   │   ├── loading.tsx             # Loading skeleton: spinner mínimo
│   │   │   │   │   ├── not-found.tsx           # 404 específico de quiz
│   │   │   │   │   └── page.tsx                # [VER DETALLE] VER DETALLE: SSR + generateMetadata dinámico + OG image; acciones jugar/editar/eliminar según rol
│   │   │   │   ├── create/                     # Segmento de ruta (portal)/quiz/create — CREAR un examen (QuizForm mode="create": en blanco o con preguntas generadas por IA)
│   │   │   │   │   ├── loading.tsx             # Skeleton mientras carga el formulario de CREAR
│   │   │   │   │   └── page.tsx                # [CREAR] CREAR: monta QuizForm mode="create" (vacío o con preguntas generadas por IA)
│   │   │   │   ├── loading.tsx                 # Loading skeleton: spinner mínimo
│   │   │   │   └── page.tsx                    # [LISTAR] LISTAR: SSR + paginación + filtros en la URL
│   │   │   ├── resources/                      # Segmento de ruta (portal)/resources — LISTAR los recursos publicados por idioma y nivel (estudiante, solo lectura)
│   │   │   │   ├── tema/                       # Segmento de ruta (portal)/resources/tema — VER DETALLE de un tema publicado: fichas con emoji/imagen y audio (solo lectura)
│   │   │   │   │   └── page.tsx                # [VER DETALLE] Página /resources/tema: todas las fichas de un tema (idioma + nivel) — vocabulario con emoji/imagen y audio de pronunciación
│   │   │   │   └── page.tsx                    # [LISTAR] LISTAR los recursos publicados por idioma y nivel (estudiante, solo lectura)
│   │   │   ├── teacher/
│   │   │   │   ├── quizzes/                    # Segmento de ruta (portal)/teacher/quizzes — LISTAR los exámenes del docente (gestión: ver, editar, eliminar)
│   │   │   │   │   └── page.tsx                # [LISTAR] LISTAR los exámenes del docente (gestión: ver, editar, eliminar)
│   │   │   │   └── students/                   # Segmento de ruta (portal)/teacher/students — LISTAR los estudiantes del docente (solo lectura)
│   │   │   │       ├── [id]/
│   │   │   │       │   └── history/            # Segmento de ruta (portal)/teacher/students/[id]/history — VER DETALLE del historial de exámenes de un estudiante (solo lectura)
│   │   │   │       │       └── page.tsx        # [VER DETALLE] VER DETALLE del historial de exámenes de un estudiante (solo lectura)
│   │   │   │       └── page.tsx                # [LISTAR] LISTAR los estudiantes del docente (solo lectura)
│   │   │   └── layout.tsx                      # Layout protegido: sidebar + navbar + auth check
│   │   ├── api/                                # Route Handlers — BFF Pattern
│   │   │   ├── [...path]/                      # Ruta comodín de los módulos nuevos
│   │   │   │   └── route.ts                    # [VER DETALLE, EDITAR, ELIMINAR] GET/POST/PATCH/DELETE → forward(); un solo archivo para todas las rutas nuevas
│   │   │   ├── admin/
│   │   │   │   └── users/                      # Route Handlers (BFF) de /api/admin/users
│   │   │   │       ├── [id]/                   # Route Handlers (BFF) de /api/admin/users/[id]
│   │   │   │       │   ├── activate/           # Route Handlers (BFF) de /api/admin/users/[id]/activate
│   │   │   │       │   │   └── route.ts        # [EDITAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │       │   └── route.ts            # [VER DETALLE, EDITAR, ELIMINAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │       └── route.ts                # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   ├── ai/                             # Route Handlers (BFF) hacia la puerta AI de NestJS
│   │   │   │   └── feedback/                   # Route Handlers (BFF) de /api/ai/feedback
│   │   │   │       └── route.ts                # [CREAR, LISTAR] Proxy a NestJS (la IA la resuelve FastAPI)
│   │   │   ├── audio/
│   │   │   │   └── route.ts                    # [VER DETALLE] audio cacheado del servidor en streaming con Range (Sprint 4.7)
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/              # Route Handlers (BFF) de /api/auth/[...nextauth]
│   │   │   │   │   └── route.ts                # [VER DETALLE, EDITAR, ELIMINAR] NextAuth: JWT + OAuth providers
│   │   │   │   ├── forgot-password/            # Route Handlers (BFF) de /api/auth/forgot-password
│   │   │   │   │   └── route.ts                # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── login/                      # Route Handlers (BFF) de /api/auth/login
│   │   │   │   │   └── route.ts                # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── logout/                     # Route Handlers (BFF) de /api/auth/logout
│   │   │   │   │   └── route.ts                # [ELIMINAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── magic-link/                 # Route Handlers (BFF) de /api/auth/magic-link
│   │   │   │   │   └── route.ts                # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── me/                         # Route Handlers (BFF) de /api/auth/me
│   │   │   │   │   └── route.ts                # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── oauth/
│   │   │   │   │   ├── [provider]/             # Route Handlers (BFF) de /api/auth/oauth/[provider]
│   │   │   │   │   │   └── route.ts            # [VER DETALLE, EDITAR, ELIMINAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   │   └── bridge/                 # Route Handlers (BFF) de /api/auth/oauth/bridge
│   │   │   │   │       └── route.ts            # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── register/                   # Route Handlers (BFF) de /api/auth/register
│   │   │   │   │   └── route.ts                # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── request-verify-email/       # Route Handlers (BFF) de /api/auth/request-verify-email
│   │   │   │   │   └── route.ts                # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── reset-password/             # Route Handlers (BFF) de /api/auth/reset-password
│   │   │   │   │   └── route.ts                # [EDITAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   └── verify-email/               # Route Handlers (BFF) de /api/auth/verify-email
│   │   │   │       └── route.ts                # [VER DETALLE] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   ├── courses/
│   │   │   │   └── [courseId]/
│   │   │   │       ├── materials/              # Route Handlers (BFF) de /api/courses/[courseId]/materials
│   │   │   │       │   ├── [id]/               # Route Handlers (BFF) de /api/courses/[courseId]/materials/[id]
│   │   │   │       │   │   ├── file/           # Route Handlers (BFF) de /api/courses/[courseId]/materials/[id]/file
│   │   │   │       │   │   │   └── route.ts    # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │       │   │   └── route.ts        # [VER DETALLE, EDITAR, ELIMINAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │       │   └── route.ts            # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │       ├── purchase/               # Route Handlers (BFF) de /api/courses/[courseId]/purchase
│   │   │   │       │   └── route.ts            # [CREAR] Compra de demostración del checkout Angular cuando el servidor no tiene claves de Stripe
│   │   │   │       └── reaction/               # Route Handlers (BFF) de /api/courses/[courseId]/reaction
│   │   │   │           └── route.ts            # [EDITAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   ├── curriculum/                     # Route Handlers (BFF) de /api/curriculum
│   │   │   │   ├── [id]/                       # Route Handlers (BFF) de /api/curriculum/[id]
│   │   │   │   │   ├── status/                 # Route Handlers (BFF) de /api/curriculum/[id]/status
│   │   │   │   │   │   └── route.ts            # [EDITAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   │   └── route.ts                # [VER DETALLE, EDITAR, ELIMINAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── ai/
│   │   │   │   │   ├── content/                # Route Handlers (BFF) de /api/curriculum/ai/content
│   │   │   │   │   │   └── route.ts            # [CREAR, LISTAR] Proxy a NestJS (la IA la resuelve FastAPI)
│   │   │   │   │   └── topics/                 # Route Handlers (BFF) de /api/curriculum/ai/topics
│   │   │   │   │       └── route.ts            # [CREAR, LISTAR] Proxy a NestJS (la IA la resuelve FastAPI)
│   │   │   │   ├── import-url/                 # Route Handlers (BFF) de /api/curriculum/import-url
│   │   │   │   │   └── route.ts                # [CREAR] Route Handler POST /api/curriculum/import-url: importa recursos desde el ENLACE de una página web (o de un PDF/Excel/CSV/Word/imagen publicado en la web)
│   │   │   │   ├── key-check/                  # Route Handlers (BFF) de /api/curriculum/key-check
│   │   │   │   │   └── route.ts                # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── sources/                    # Route Handlers (BFF) de /api/curriculum/sources
│   │   │   │   │   └── route.ts                # [CREAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── topics/                     # Route Handlers (BFF) de /api/curriculum/topics
│   │   │   │   │   └── route.ts                # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   └── route.ts                    # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   ├── dialogues/              # Route Handlers (BFF) de /api/dialogues (el resto pasa por [...path])
│   │   │   │   └── import-url/
│   │   │   │       └── route.ts        # [CREAR] texto de una página con un diálogo (safeFetch anti-SSRF) · 2026-10-19
│   │   │   ├── notifications/                  # Route Handlers (BFF) de /api/notifications
│   │   │   │   └── route.ts                    # [CREAR, LISTAR] Route Handler /api/notifications: campana del topbar → NestJS /notifications/me
│   │   │   └── quiz/                           # Route Handlers (BFF) de /api/quiz
│   │   │       ├── [id]/                       # Route Handlers (BFF) de /api/quiz/[id]
│   │   │       │   ├── session/                # Route Handlers (BFF) de /api/quiz/[id]/session
│   │   │       │   │   └── route.ts            # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │       │   └── route.ts                # [VER DETALLE, EDITAR, ELIMINAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │       ├── ai/
│   │   │       │   └── generate/               # Route Handlers (BFF) de /api/quiz/ai/generate
│   │   │       │       └── route.ts            # [CREAR] Proxy a NestJS (la IA la resuelve FastAPI)
│   │   │       ├── session/
│   │   │       │   └── [sessionId]/
│   │   │       │       ├── answer/             # Route Handlers (BFF) de /api/quiz/session/[sessionId]/answer
│   │   │       │       │   └── route.ts        # [EDITAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │       │       └── end/                # Route Handlers (BFF) de /api/quiz/session/[sessionId]/end
│   │   │       │           └── route.ts        # [EDITAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │       ├── sessions/
│   │   │       │   └── me/                     # Route Handlers (BFF) de /api/quiz/sessions/me
│   │   │       │       └── route.ts            # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │       └── route.ts                    # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   ├── idiomas/
│   │   │   └── [lang]/                         # Segmento de ruta idiomas/[lang] — VER la landing de un idioma (pública, SSG)
│   │   │       └── page.tsx                    # [VER DETALLE] landing por idioma con metadatos propios (SSG)
│   │   ├── error.tsx                           # Error Boundary global (patrón React)
│   │   ├── favicon.ico                         # Icono del sitio
│   │   ├── globals.css                         # Tailwind directives + CSS custom properties
│   │   ├── landing.css                         # landing
│   │   ├── layout.tsx                          # Root layout: fonts + providers + metadata base
│   │   ├── not-found.tsx                       # 404 global
│   │   ├── page.tsx                            # Redirect a /dashboard o /login
│   │   ├── robots.ts                           # robots.txt generado (SEO)
│   │   └── sitemap.ts                          # Sitemap dinámico generado en build (SEO)
│   ├── components/                             # Atomic Design
│   │   ├── admin/
│   │   │   ├── DeactivateUserButton.tsx        # [ELIMINAR] DeactivateUserButton (Client/Presentational)
│   │   │   └── RowActions.tsx                  # RowActions (Client/Presentational)
│   │   ├── ai/                                 # Molecules — dominio IA
│   │   │   ├── AssistantChat.tsx               # asc: chat tutor IA con SSE stream · ⚠ archivo vacío (marcador) · ⚠ DUPLICADO: el chat del tutor vive en Angular (features/assistant, módulo Assistant) → eliminar este marcador
│   │   │   ├── FeedbackPanel.tsx               # fbp: panel feedback post-quiz con secciones
│   │   │   ├── RecommendationCard.tsx          # rcc: sugerencia de estudio · ⚠ archivo vacío (marcador) · ⚠ DUPLICADO: las recomendaciones viven en Angular (features/feedback, módulo Feedback) → eliminar este marcador
│   │   │   └── WeaknessChart.tsx               # wkc: gráfico recharts áreas de mejora
│   │   ├── auth/                               # Molecules — dominio Auth
│   │   │   ├── ForgotPasswordForm.tsx          # [CREAR, VER DETALLE, EDITAR] ForgotPasswordForm (Client/Presentational)
│   │   │   ├── LoginForm.tsx                   # lgf: form + Zod + RHF + error messages a11y
│   │   │   ├── LogoutButton.tsx                # [ELIMINAR] LogoutButton: invoca /api/auth/logout y redirige
│   │   │   ├── OAuthButtons.tsx                # oab: Google + GitHub con aria-label
│   │   │   ├── ProtectedRoute.tsx              # prt: HOC redirect si no auth (Guard pattern) · ⚠ archivo vacío (marcador)
│   │   │   ├── RegisterForm.tsx                # [CREAR] rgf: multi-step + validación por paso
│   │   │   ├── ResetPasswordForm.tsx           # [EDITAR] ResetPasswordForm (Client/Presentational)
│   │   │   └── VerifyEmailForm.tsx             # [VER DETALLE] VerifyEmailForm (Client/Presentational)
│   │   ├── courses/
│   │   │   ├── CourseActions.tsx               # CourseActions (Client/Presentational)
│   │   │   ├── CourseBadge.tsx                 # CourseBadge (Client/Presentational)
│   │   │   ├── CourseCard.tsx                  # CourseCard (Client/Presentational)
│   │   │   ├── CourseFilter.tsx                # CourseFilter (Client/Presentational)
│   │   │   ├── CourseGrid.tsx                  # CourseGrid (Client/Presentational)
│   │   │   ├── CourseLesson.tsx                # CourseLesson (Client/Presentational) · si la URL firmada del video caduca, la vuelve a pedir y retoma el segundo (Sprint 6.7)
│   │   │   ├── CourseMaterials.tsx             # CourseMaterials (Client/Presentational)
│   │   │   ├── CoursePrice.tsx                 # CoursePrice (Client/Presentational)
│   │   │   ├── PdfReader.tsx                   # PdfReader (Client/Presentational)
│   │   │   └── SyllabusList.tsx                # [LISTAR] SyllabusList (Client/Presentational)
│   │   ├── curriculum/
│   │   │   ├── CatalogCreatePanels.tsx         # CatalogCreatePanels (Client/Presentational)
│   │   │   ├── ContentEditor.tsx               # ContentEditor (Client/Presentational)
│   │   │   ├── ContradictionScanButton.tsx     # [EDITAR] «Comparar fuentes» del idioma filtrado (Server Action + aria-live)
│   │   │   ├── CurriculumBadges.tsx            # CurriculumBadges (Client/Presentational)
│   │   │   ├── CurriculumItemForm.tsx          # [CREAR, VER DETALLE, EDITAR] Formulario ÚNICO de recurso curricular (DRY): mode="create" = en blanco · mode="edit" = cargado con los datos · mode="view" = solo lectura. Las páginas new/, [id]/ y [id]/edit/ solo cargan los datos y eligen el modo; el envío va a la Server Action del módulo (createCurriculumItemAction / updateCurriculumItemAction)
│   │   │   ├── EmojiPicker.tsx                 # Next.js: Client Component → modal interactivo con búsqueda
│   │   │   ├── GenerationTrace.tsx             # GenerationTrace (Client/Presentational)
│   │   │   ├── ImportPanel.tsx                 # [CREAR] Next.js: Client Component → lee archivos locales con APIs del navegador
│   │   │   ├── ResourcePreview.tsx             # ResourcePreview (Client/Presentational)
│   │   │   ├── ReviewStatusActions.tsx         # [EDITAR] ReviewStatusActions (Client/Presentational)
│   │   │   ├── SearchSelect.tsx                # [LISTAR] SearchSelect (Client/Presentational)
│   │   │   └── SpeakButton.tsx                 # Next.js: Client Component → usa la Web Speech API del navegador
│   │   ├── landing/
│   │   │   ├── CtaFooter.tsx                   # CTA final + pie con enlaces legales
│   │   │   ├── FaqSection.tsx                  # FAQ breve con JSON-LD FAQPage
│   │   │   ├── Hero.tsx                        # Hero (propuesta de valor + CTA)
│   │   │   ├── HowItWorks.tsx                  # cómo funciona (3 pasos)
│   │   │   ├── LanguagesGrid.tsx               # siete idiomas
│   │   │   ├── LevelsMcer.tsx                  # niveles A1–C2
│   │   │   ├── LocalAiPrivacy.tsx              # IA local y privacidad
│   │   │   └── Pricing.tsx                     # planes y métodos de pago (tarjeta, cripto)
│   │   ├── language/
│   │   │   ├── AccentPreference.tsx            # lee y escribe la cookie de acento UK/US compartida con Angular · host de un remoto Angular (transversal)
│   │   │   ├── IpaTextHost.tsx                 # monta <aula-ipa-text> con respaldo de texto plano si el remoto no responde · host de un remoto Angular (transversal)
│   │   │   ├── PolyglotNavLink.tsx             # opción «Poliglota» en la sección de recursos, junto a los siete idiomas · host de un remoto Angular (transversal)
│   │   │   ├── ResourceVocabularyField.tsx     # campo de vocabulario del editor de recursos: al agregar un término muestra traducción e IPA UK/US editables
│   │   │   ├── TopicTitle.tsx          # tema en el idioma estudiado con IPA, audio y traducción · 2026-10-19
│   │   │   └── WordLookupHost.tsx              # envuelve un texto con <aula-word-lookup> y deja el texto plano si el remoto no responde · host de un remoto Angular (transversal)
│   │   ├── layout/                             # Organisms — estructura global
│   │   │   ├── Footer.tsx                      # ftr: links semánticos + copyright · ⚠ archivo vacío (marcador)
│   │   │   ├── Navbar.tsx                      # nvb: nav + skip-to-content + user menu + dark mode · ⚠ archivo vacío (marcador)
│   │   │   ├── PageHeader.tsx                  # pgh: breadcrumb (aria) + título + acciones · ⚠ archivo vacío (marcador)
│   │   │   ├── PreferencesProvider.tsx         # PreferencesProvider (Client): tema e idioma; emite aula:theme-changed / aula:locale-changed para los remotos Angular
│   │   │   ├── PublicNavbar.tsx                # PublicNavbar (Client/Presentational)
│   │   │   ├── Sidebar.tsx                     # sdb: nav lateral + collapse mobile + aria-expanded · ⚠ archivo vacío (marcador)
│   │   │   └── ThemeProvider.tsx               # thp: next-themes dark/light sin flash · ⚠ archivo vacío (marcador)
│   │   ├── leaderboard/                        # Molecules — dominio Ranking
│   │   │   ├── LeaderboardTable.tsx            # [LISTAR] lbt: tabla ranking paginada + aria-sort · ⚠ archivo vacío (marcador)
│   │   │   ├── RankBadge.tsx                   # rnb: medallas #1 #2 #3 con aria-label · ⚠ archivo vacío (marcador)
│   │   │   └── UserRankRow.tsx                 # urr: fila de usuario con avatar + score · ⚠ archivo vacío (marcador)
│   │   ├── portal/                             # Organisms del portal: barra superior, menú lateral y paneles
│   │   │   ├── AnalyticsFilters.tsx            # AnalyticsFilters (Client/Presentational)
│   │   │   ├── ChartBars.tsx                   # ChartBars (Client/Presentational)
│   │   │   ├── Donut.tsx                       # Donut (Client/Presentational)
│   │   │   ├── Dropdown.tsx                    # Next.js: Client Component → estado de apertura y eventos del documento
│   │   │   ├── ManagementHeader.tsx            # Next.js: navegación cliente con prefetch; las pestañas son enlaces reales (funcionan sin JS)
│   │   │   ├── MobileNav.tsx                   # MobileNav (Client/Presentational)
│   │   │   ├── Panel.tsx                       # Panel
│   │   │   ├── portal-role.ts                  # Rol de UI del portal: módulo neutro (sin "use client") → lo usan Server y Client Components
│   │   │   ├── PortalSidebar.tsx               # PortalSidebar (Client): lee la navegación compartida de packages/shared-nav (@aula/shared-nav)
│   │   │   ├── PortalToolbar.tsx               # PortalToolbar (Client/Presentational)
│   │   │   ├── PortalTopbar.tsx                # PortalTopbar (Client/Presentational)
│   │   │   ├── quiz-format.ts                  # Delegado al SSOT: etiqueta + banda MCER/CEFR
│   │   │   ├── RecItem.tsx                     # RecItem
│   │   │   ├── StatCard.tsx                    # StatCard (Client/Presentational)
│   │   │   ├── Tag.tsx                         # Tag
│   │   │   └── Topbar.tsx                      # Topbar de página: título + subtítulo + acciones propias de cada dashboard
│   │   ├── quiz/                               # Molecules — dominio Quiz
│   │   │   ├── AnswerOption.tsx                # ano: radio accesible con estado visual
│   │   │   ├── CategoryIcon.tsx                # cti: icono Lucide + aria-label descriptivo
│   │   │   ├── DifficultyBadge.tsx             # dfb: nivel dificultad con color + texto (no solo color)
│   │   │   ├── QuestionCard.tsx                # qnc: pregunta + opciones + keyboard nav (a11y)
│   │   │   ├── QuizActions.tsx                 # QuizActions: botones acciones quiz para docente/admin
│   │   │   ├── QuizAdminTable.tsx              # [LISTAR] QuizAdminTable (Client/Presentational)
│   │   │   ├── QuizCard.tsx                    # qzc: tarjeta resumen con link semántico
│   │   │   ├── QuizFilter.tsx                  # qzf: filtros en URL (URL State Pattern) · ⚠ archivo vacío (marcador)
│   │   │   ├── QuizForm.tsx                    # [CREAR, VER DETALLE, EDITAR] Formulario ÚNICO de examen (DRY): mode="create" = en blanco · mode="edit" = cargado con los datos · mode="view" = solo lectura. Las páginas new/, [id]/ y [id]/edit/ solo cargan los datos y eligen el modo; el envío va a la Server Action del módulo (createQuizAction / updateQuizAction)
│   │   │   ├── QuizGrid.tsx                    # qzg: grid responsivo sm:1 md:2 lg:3 cols
│   │   │   ├── QuizProgress.tsx                # qzp: N/total preguntas con aria-label
│   │   │   ├── ScoreDisplay.tsx                # scd: puntuación animada (respeta reduced-motion)
│   │   │   └── TimerBar.tsx                    # tmb: aria-live="polite" + aria-valuenow
│   │   ├── shared/                             # Shared UI — cross-domain
│   │   │   ├── AngularElements.tsx          # Carga /ng/main.js y /ng/styles.css una vez → <aula-exportar>, <aula-campana>
│   │   │   ├── ConfirmDialog.tsx               # [EDITAR] cfd: confirmación destructiva + focus trap · ⚠ archivo vacío (marcador)
│   │   │   ├── EmptyState.tsx                  # ems: Null Object pattern + CTA
│   │   │   ├── ErrorBoundary.tsx               # erb: captura errores React + fallback UI
│   │   │   ├── LoadingSpinner.tsx              # lsp: aria-busy + aria-label "Cargando" · ⚠ archivo vacío (marcador)
│   │   │   ├── Pagination.tsx                  # pgn: aria-label + URL state · ⚠ archivo vacío (marcador)
│   │   │   ├── ResultDialog.tsx                # ResultDialog (Client/Presentational)
│   │   │   ├── Toaster.tsx             # avisos «guardado / editado / eliminado» (evento aula:toast compartido con Angular) · 2026-10-19
│   │   │   ├── SearchBar.tsx                   # [LISTAR] srb: debounce 300ms + aria-label · ⚠ archivo vacío (marcador)
│   │   │   └── SEOHead.tsx                     # seo: OG tags + JSON-LD structured data
│   │   └── ui/                                 # Atoms — shadcn/ui primitivas accesibles
│   │       ├── avatar.tsx                      # avt: img con alt + fallback iniciales · ⚠ archivo vacío (marcador)
│   │       ├── badge.tsx                       # bdg: colores semánticos + role="status" · ⚠ archivo vacío (marcador)
│   │       ├── button.tsx                      # btn: variantes CVA + aria-disabled + focus-visible
│   │       ├── card.tsx                        # crd: composable Card.Root/Header/Content/Footer · ⚠ archivo vacío (marcador)
│   │       ├── dialog.tsx                      # dlg: focus trap + Escape + aria-modal (Portal)
│   │       ├── input.tsx                       # inp: label asociado + error message + aria-invalid
│   │       ├── label.tsx                       # lbl: htmlFor obligatorio (a11y)
│   │       ├── password-input.tsx              # PasswordInput: input con toggle ver/ocultar contraseña
│   │       ├── progress.tsx                    # prg: aria-valuenow + aria-valuemax · ⚠ archivo vacío (marcador)
│   │       ├── select.tsx                      # sel: Radix Select + aria-expanded · ⚠ archivo vacío (marcador)
│   │       ├── separator.tsx                   # sep: role="separator" + aria-orientation · ⚠ archivo vacío (marcador)
│   │       ├── skeleton.tsx                    # skl: aria-busy placeholder de carga · ⚠ archivo vacío (marcador)
│   │       ├── tabs.tsx                        # tab: aria-tablist + aria-selected · ⚠ archivo vacío (marcador)
│   │       ├── toast.tsx                       # tst: aria-live="assertive" notificaciones · ⚠ archivo vacío (marcador)
│   │       └── tooltip.tsx                     # ttp: aria-describedby + no solo color · ⚠ archivo vacío (marcador)
│   ├── config/                                 # Configuración
│   │   ├── angular.ts                       # Remoto Angular: ANGULAR_PREFIXES (rewrites + rutas protegidas), base /ng y ANGULAR_URL
│   │   ├── brand.ts                            # Marca (constantes TypeScript)
│   │   └── curriculum-topics.ts                # Temas del currículo (constantes TypeScript) · menú, temas e i18n viven en packages/* (Sprint 7.1)
│   ├── hooks/                                  # Custom Hooks — lógica reutilizable
│   │   ├── useAuth.ts                          # Sesión, roles, isLoading, redirect logic
│   │   ├── useCart.ts                          # useCart
│   │   ├── useCourses.ts                       # useCourseReactions: reacciones con actualización optimista y rollback
│   │   ├── useDebounce.ts                      # Debounce genérico type-safe <T>
│   │   ├── useKeyboard.ts                      # Atajos de teclado accesibles (a11y) · ⚠ archivo vacío (marcador)
│   │   ├── useLocalStorage.ts                  # Persistencia local type-safe con Zod parse
│   │   ├── useMediaQuery.ts                    # Responsive breakpoints TS-safe (sm/md/lg/xl) · ⚠ archivo vacío (marcador)
│   │   ├── useProfile.ts                       # useProfile · ⚠ archivo vacío (marcador)
│   │   ├── useQuiz.ts                          # Flujo: responder, avanzar, fin de sesión
│   │   ├── useSSE.ts                           # Server-Sent Events: EventSource compartido por URL (avisos en tiempo real, Last-Event-ID)
│   │   └── useTimer.ts                         # Countdown + onTimeout + pause/resume
│   ├── lib/                                    # Utilidades — capa Infraestructura FE
│   │   ├── bff/                                # Utilidades del BFF
│   │   │   └── forward.ts                      # reenvío único hacia NestJS: cookie httpOnly → Bearer, cuerpo, multipart, Range/206 y SSE
│   │   ├── api-client.ts                       # fetch nativo: baseURL + Bearer JWT
│   │   ├── auth-config.ts                      # Configuración Auth.js v5: providers OAuth + callbacks mínimos para flujo bridge
│   │   ├── auth-nextauth.ts                    # auth-nextauth
│   │   ├── auth.ts                             # NextAuth config: providers, callbacks, session
│   │   ├── bff.ts                              # Helper BFF: plantilla común de Route Handlers mutadores (parseo JSON, refresco de token, traducción de errores)
│   │   ├── categories.ts                       # SSOT competencias lingüísticas: valor (enum backend) + etiqueta ES + emoji en un solo lugar
│   │   ├── constants.ts                        # Constantes globales (DRY)
│   │   ├── courses-api.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] courses-api
│   │   ├── curriculum-api.ts                   # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] curriculum-api
│   │   ├── errors.ts                           # Error classes tipadas + mensajes de usuario
│   │   ├── help-api.ts                         # [LISTAR, VER DETALLE] faqs públicas (solo lectura)
│   │   ├── i18n-server.ts                      # i18n-server
│   │   ├── jobs-api.ts                         # [LISTAR, VER DETALLE, EDITAR] listJobs() y getJob(id) hacia NestJS /admin/jobs (solo servidor); el BFF usa la ruta comodín app/api/[...path]
│   │   ├── languages.ts                        # SSOT idiomas objetivo: código ISO 639-1 + etiqueta ES, alineado con Language VO del backend
│   │   ├── materials-client.ts                 # materials-client
│   │   ├── oauth-bridge.ts                     # oauth-bridge
│   │   ├── pdf-text.ts                         # pdfText: extrae el texto de un PDF con pdf.js en un Web Worker (líneas separadas por \n, páginas por \n\n)
│   │   ├── period.ts                           # Filtro de periodo compartido por dashboards y reportes (parsePeriod)
│   │   ├── profile-api.ts                      # [LISTAR, VER DETALLE, EDITAR] profile-api
│   │   ├── purchase-actions.ts                 # [CREAR] RPC tipado al backend
│   │   ├── quiz-api.ts                         # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Fachada HTTP de Quiz · ⚠ FRAGMENTACIÓN: también expone usuarios (listUsers, getUser, listStudents) y puntajes (getUserStats, getLeaderboard); separar en users-api.ts y score-api.ts
│   │   ├── resource-import.ts                  # Importación de recursos: convierte filas de texto (de Excel, Word, PDF, OCR o .txt) en contenidos por tipo de recurso, listos para revisar en el formulario
│   │   ├── safe-fetch.ts                       # Solo servidor: usa módulos node:* (dns, http, net) → no puede empaquetarse para el navegador
│   │   ├── seo.ts                              # Helpers generateMetadata + JSON-LD schemas
│   │   ├── slug.ts                             # Slug determinista: espejo exacto de apps/backend/src/modules/curriculum/domain/slug.ts (vista previa en UI; el backend es la autoridad)
│   │   ├── speech.ts                           # Speech: pronunciación con la voz del navegador (Web Speech API, sin servidor ni red)
│   │   ├── stream-proxy.ts                     # [VER DETALLE] streaming BFF ↔ NestJS (Range/206, SSE) · redirect manual: la 302 a la URL firmada de S3/R2 llega al navegador (Sprint 6.7)
│   │   ├── utils.ts                            # cn() + formatters + helpers generales
│   │   └── validations.ts                      # Zod schemas: login, register, quiz, profile
│   ├── store/                                  # Redux Toolkit — capa Estado
│   │   ├── api/                                # RTK Query — data fetching + caché
│   │   │   ├── aiApi.ts                        # [CREAR, LISTAR] Endpoints: grading, feedback, chat · ⚠ archivo vacío (marcador)
│   │   │   ├── authApi.ts                      # [CREAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints: login, register, refresh, logout · ⚠ archivo vacío (marcador)
│   │   │   ├── baseApi.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Base: baseURL + prepareHeaders JWT + retry · ⚠ archivo vacío (marcador)
│   │   │   ├── coursesApi.ts                   # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Facade de cliente · coursesApi: postReaction → BFF /api/courses/:id/reaction
│   │   │   ├── quizApi.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Endpoints: CRUD quiz y preguntas generadas con IA · ⚠ archivo vacío (marcador)
│   │   │   └── scoreApi.ts                     # [LISTAR, VER DETALLE] Endpoints: submit, historial, leaderboard · ⚠ archivo vacío (marcador)
│   │   ├── slices/                             # Redux slices
│   │   │   ├── authSlice.ts                    # ath: user, token, roles, isAuthenticated
│   │   │   ├── coursesSlice.ts                 # Slice Courses: estado UI del catálogo (filtros + búsqueda + reacciones locales)
│   │   │   ├── quizSlice.ts                    # qzs: sesión activa, pregunta actual, respuestas
│   │   │   ├── timerSlice.ts                   # tms: countdown, estado (running/paused/ended)
│   │   │   └── uiSlice.ts                      # uis: sidebar open/close, theme, modal stack · ⚠ archivo vacío (marcador)
│   │   ├── index.ts                            # Store: middleware + devtools + SSR hydration
│   │   └── provider.tsx                        # StoreProvider para App Router
│   ├── types/                                  # TypeScript — tipado estricto
│   │   ├── angular-elements.d.ts            # Tipos JSX de los Angular Elements (<aula-exportar period-months>, <aula-campana href>)
│   │   ├── courses.ts                          # courses
│   │   ├── curriculum.ts                       # curriculum
│   │   ├── env.d.ts                            # Type-safe process.env (t3-env + Zod) · ⚠ archivo vacío (marcador)
│   │   ├── global.d.ts                         # Tipos globales de la aplicación · ⚠ archivo vacío (marcador)
│   │   ├── next-auth.d.ts                      # Extend Session/JWT con roles y userId
│   │   ├── profile.ts                          # profile
│   │   └── quiz.ts                             # Tipos compartidos Quiz: SSOT entre frontend y backend
│   ├── auth.config.ts                          # Auth.js v5 config edge-safe: providers OAuth + matchers para proxy edge
│   ├── auth.ts                                 # Auth.js v5 root: providers + callbacks JWT/session que delegan en NestJS
│   └── proxy.ts                                # Middleware: rutas protegidas + JWT check + redirect
├── __tests__/                                  # ══ PRUEBAS ══════════════════════════════
│   ├── functional/                             # FUNCIONALES (E2E) — Playwright
│   │   ├── admin-users-section.spec.ts         # E2E: listar, crear, editar y desactivar usuarios
│   │   ├── ai-feedback.spec.ts                 # Quiz con errores → FeedbackPanel con IA visible
│   │   ├── ai-quiz-generation.spec.ts          # E2E: crear examen con preguntas generadas por IA
│   │   ├── auth.spec.ts                        # Registro → verificación → login → dashboard
│   │   ├── dark-mode.spec.ts                   # Toggle dark/light sin flash + contraste correcto
│   │   ├── leaderboard.spec.ts                 # Jugar quiz → score aparece en ranking
│   │   ├── navigation.spec.ts                  # Todas las rutas cargan sin errores JS
│   │   ├── protected-routes.spec.ts            # Rutas /protected redirigen a /login sin token
│   │   ├── quiz-flow.spec.ts                   # Seleccionar quiz → responder todas → ver score
│   │   └── session-expiry.spec.ts              # Token expirado → redirect login → retorno a ruta
│   ├── integration/                            # INTEGRACIÓN — Jest + MSW 2.x
│   │   ├── AssistantChat.test.tsx              # MSW SSE mock → mensajes en tiempo real · ⚠ DUPLICADO: el chat del tutor vive en Angular (features/assistant, módulo Assistant) → eliminar este marcador
│   │   ├── AuthFlow.test.tsx                   # Login → token en Redux → request con Authorization
│   │   ├── FeedbackPanel.test.tsx              # RTK Query aiApi → FeedbackPanel renderiza datos IA
│   │   ├── Leaderboard.test.tsx                # Fetch ranking MSW → tabla ordenada correctamente
│   │   ├── QuizPage.test.tsx                   # Fetch preguntas MSW → render QuizGrid → click quiz
│   │   ├── QuizPlay.test.tsx                   # Responder preguntas → score → pantalla resultados
│   │   └── UserAdminSection.test.tsx           # Sección de usuarios con MSW
│   ├── performance/                            # RENDIMIENTO — Lighthouse CI + Playwright
│   │   ├── bundle.analysis.ts                  # @next/bundle-analyzer: JS principal <200KB gz
│   │   ├── landing.perf.spec.ts                # Playwright: TTI <3.5s en 3G throttled (mobile)
│   │   ├── lighthouse.config.js                # Config: LCP<2.5s, FID<100ms, CLS<0.1
│   │   ├── navigation.perf.spec.ts             # SPA routing entre rutas <200ms p95
│   │   └── quiz-page.perf.spec.ts              # LCP <2.5s SSR con 10 preguntas cargadas
│   ├── unit/                                   # UNITARIAS — Jest + Testing Library
│   │   ├── a11y/
│   │   │   ├── atoms.a11y.test.tsx             # jest-axe: 0 violaciones en todos los atoms
│   │   │   └── molecules.a11y.test.tsx         # jest-axe: QuizCard, QuestionCard, LoginForm
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   │   ├── NewUserPage.test.tsx        # [CREAR] CREAR: monta UserForm mode="create"
│   │   │   │   └── UserForm.test.tsx           # UserForm en modos create, edit y view
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.test.tsx          # Validación Zod: email inválido muestra error
│   │   │   │   ├── OAuthButtons.test.tsx       # Botones OAuth con aria-label y redirección
│   │   │   │   └── RegisterForm.test.tsx       # [CREAR] Multi-step: avanza solo si paso actual es válido
│   │   │   ├── language/
│   │   │   │   ├── ResourceVocabularyField.test.tsx  # «Usar» traducción e IPA UK/US, IA caída y respaldo de <IpaTextHost>
│   │   │   │   └── WordLookupHost.test.tsx     # <aula-word-lookup> solo si el remoto está registrado (respaldo de texto plano) y enlace «Poliglota» en Recursos
│   │   │   ├── portal/
│   │   │   │   └── AnalyticsFilters.test.tsx   # Filtro de periodo de dashboards
│   │   │   ├── quiz/
│   │   │   │   ├── AnswerOption.test.tsx       # Estado correcto/incorrecto con feedback visual
│   │   │   │   ├── QuestionCard.test.tsx       # Renderiza 4 opciones, resalta respuesta seleccionada
│   │   │   │   ├── ScoreDisplay.test.tsx       # Score renderiza correctamente con distintos valores
│   │   │   │   └── TimerBar.test.tsx           # aria-live anuncia cambios, color rojo < 10s
│   │   │   ├── shared/
│   │   │   │   ├── EmptyState.test.tsx         # Renderiza CTA cuando lista está vacía
│   │   │   │   └── ErrorBoundary.test.tsx      # Captura error hijo y muestra fallback UI
│   │   │   └── ui/
│   │   │       ├── button.test.tsx             # Variantes CVA, estados disabled, aria-disabled
│   │   │       ├── dialog.test.tsx             # Focus trap activo, Escape cierra, aria-modal
│   │   │       └── input.test.tsx              # aria-invalid cuando hay error, label asociado
│   │   ├── hooks/
│   │   │   ├── useAuth.test.ts                 # Devuelve user/roles, redirige si no auth
│   │   │   ├── useDebounce.test.ts             # Retrasa actualización N ms correctamente
│   │   │   ├── useLocalStorage.test.ts         # Persiste y parsea tipo genérico con Zod
│   │   │   └── useTimer.test.ts                # Decrementa cada 1s, llama onTimeout() en 0
│   │   ├── lib/
│   │   │   ├── categories.test.ts              # SSOT de competencias: valor, etiqueta y emoji
│   │   │   ├── forward.test.ts                 # Lista blanca del BFF comodín (incl. games, practice, vocabulary, speech, music y dialogues), SSE, 206 del audio y 413 si supera 10 MB (20 MB en música)
│   │   │   ├── languages.test.ts               # SSOT de idiomas
│   │   │   ├── materials.test.ts               # Cliente de materiales
│   │   │   ├── period.test.ts                  # parsePeriod
│   │   │   ├── resource-import.test.ts         # Filas importadas → contenidos por tipo
│   │   │   ├── safe-fetch.test.ts              # Bloquea IP privadas (SSRF)
│   │   │   ├── slug.test.ts                    # Slug determinista igual al del backend
│   │   │   ├── stream-proxy.test.ts            # [Sprint 6.7] 302 a la URL firmada sin seguir la redirección; reenvía Location y Range
│   │   │   ├── utils.test.ts                   # cn() resuelve conflictos Tailwind correctamente
│   │   │   └── validations.test.ts             # Schemas Zod: casos válidos e inválidos
│   │   ├── store/
│   │   │   ├── authSlice.test.ts               # setCredentials guarda user+token, logout limpia
│   │   │   ├── quizSlice.test.ts               # setAnswer guarda respuesta, nextQuestion avanza índice
│   │   │   └── timerSlice.test.ts              # tick decrementa, pause detiene, reset reinicia
│   │   └── test-utils.tsx                      # Render con providers para las pruebas
│   └── usability/                              # USABILIDAD — Playwright + axe + SUS
│       ├── accessibility.spec.ts               # axe-playwright: 0 violaciones críticas en 6 rutas
│       ├── cross-browser.spec.ts               # Chromium + Firefox + WebKit: funcionalidad core
│       ├── dark-mode-contrast.spec.ts          # Contraste WCAG ≥4.5:1 en todos los componentes dark
│       ├── error-handling-ux.spec.ts           # Errores 404/500: EmptyState visible + botón retry
│       ├── i18n.spec.ts                        # ES/EN: textos completos sin truncación
│       ├── keyboard-nav.spec.ts                # Tab/Enter/Escape: flujo completo sin ratón
│       └── responsive.spec.ts                  # Viewports: 320/768/1024/1440/2560px sin overflow
├── public/
│   ├── fonts/                                  # Fuentes self-hosted (perf — evita FOUT)
│   ├── icons/                                  # Favicons PWA + manifest.json
│   └── images/                                 # Imágenes estáticas optimizadas (WebP)
├── .env.example                                # Plantilla de variables de entorno
├── .env.local                                  # Variables locales (no commitear — .gitignore)
├── components.json                             # shadcn/ui: config paths + style tokens
├── jest.config.ts                              # jsdom + coverage thresholds + moduleNameMapper · ℹ definido en next_estructura.md; no existe en el código
├── jest.setup.ts                               # jest-dom matchers + MSW server setup
├── lighthouserc.js                             # Lighthouse CI thresholds (Core Web Vitals)
├── next.config.ts                              # Turbopack + rewrites hacia el remoto Angular (/ng/*, /tutor, /redaccion, /estudio/*, /notificaciones, /reportes/*)
├── package.json                                # Configuración
├── playwright.config.ts                        # Browsers + baseURL + retries + reporters
├── tailwind.config.ts                          # Tokens: colores, tipografía, breakpoints, dark mode
└── tsconfig.json                               # strict:true + paths alias @/ + decoratorMetadata
packages/                                       # Código compartido entre Next.js y Angular (RF-86 · Sprint 7.1) — alias @aula/* en los tsconfig de las dos apps; sin dependencias de runtime
├── api-client/
│   ├── generated.ts                            # Contrato de la API de NestJS generado desde su OpenAPI (openapi-typescript · `pnpm api:types`)
│   └── index.ts                                # Tipos derivados (ApiRoute, ApiPrefix): la lista blanca del BFF se valida en compilación
├── eslint-config/
│   └── index.js                                # Política «una librería por función» (no-restricted-imports) para Next.js, NestJS y Angular
├── shared-i18n/
│   ├── en.json                                 # Diccionario EN
│   ├── es.json                                 # Diccionario ES (define la forma: Dictionary)
│   └── index.ts                                # getDictionary, fmt, plural, LOCALES, INTL_LOCALE (helpers puros)
├── shared-nav/
│   └── navigation.ts                           # Navegación única por rol (shell y remotos)
├── shared-schemas/
│   └── index.ts                                # Valores del dominio (idiomas, niveles MCER, roles, audiencias) para z.enum en cada app
└── ui-tokens/
    ├── motion.css                              # prefers-reduced-motion: anula animaciones no esenciales (RF-70) · lo importa globals.css
    └── tailwind-preset.ts                      # Temas de Tailwind CSS 4: lista tipada de los 6 temas, metadatos y script anti-parpadeo (RF-70)
```

## Convenciones CRUD y reutilización de formularios (iguales en la matriz)

Cada entidad con pantalla de gestión sigue **la misma forma de carpetas**; el segmento dice qué hace la ruta:

| Segmento | Acción | Página | Componente que monta |
|----------|--------|--------|----------------------|
| `<módulo>/` | **LISTAR** (tabla o tarjetas con acciones por fila) | `page.tsx` | tabla/lista del módulo |
| `<módulo>/new/` | **CREAR** (formulario en blanco) | `new/page.tsx` | `<Entidad>Form mode="create"` |
| `<módulo>/[id]/` | **VER DETALLE** (solo lectura) + botón **ELIMINAR** | `[id]/page.tsx` | `<Entidad>Form mode="view"` |
| `<módulo>/[id]/edit/` | **EDITAR** (formulario cargado con los datos) | `[id]/edit/page.tsx` | `<Entidad>Form mode="edit"` |
| `<módulo>/actions.ts` | Mutaciones | Server Actions | `create<Entidad>Action` · `update<Entidad>Action` · `delete<Entidad>Action` |

- **Un solo formulario por entidad** (DRY), con el nombre y la ubicación que tiene en el código: `admin/users/UserForm.tsx`, `admin/courses/CourseForm.tsx`, `profile/edit/ProfileEditForm.tsx`, `components/quiz/QuizForm.tsx`, `components/curriculum/CurriculumItemForm.tsx`. Tiene los mismos campos en los tres modos; las páginas solo **cargan** los datos (o no, si es crear) y eligen el `mode`; el formulario decide si los campos son editables y a qué Server Action envía.
- Nombres: carpeta y archivos en inglés; componentes en PascalCase con el nombre de la entidad (`<Entidad>Form`, `<Entidad>Card`, `<Entidad>Table`); `lib/<módulo>-api.ts` para la fachada HTTP; `types/<módulo>.ts`.
- Segmentos tal como están en el código: `new/` y `[id]/edit/` en users, courses y curriculum; `quiz/create/`, `curriculum/tema/` (`tema/editar/`), `resources/tema/` y `dashboard/docente|estudiante/` conservan su nombre porque cambiarlo cambia las URL públicas.

**Nombres cortos y con sentido:** verbo + entidad, máximo unas 3 palabras antes del sufijo técnico; sin librerías, «my» ni detalles internos en el nombre (`link-wallet.use-case.ts`, no `verify-siwe-and-link-wallet.use-case.ts`; `get-audio`, no `get-or-create-audio`; `whisper_transcriber.py`, no `faster_whisper_transcriber.py`).

## Patrones React Aplicados en la Estructura

### Patrones de Componentes (patterns.dev/react)

| Patrón | Dónde en la estructura | Implementación |
|--------|----------------------|----------------|
| **HOC Pattern** | `components/auth/ProtectedRoute.tsx` | `withAuth(Component)` redirige si no hay sesión; `withRoles(Component)` oculta por rol |
| **Hooks Pattern** | `hooks/` — todos los archivos | `useTimer`, `useAuth`, `useQuiz`, `useSSE`, `useDebounce` extraen lógica reutilizable |
| **Compound Pattern** | `components/quiz/QuizCard.tsx` | `QuizCard.Root + QuizCard.Header + QuizCard.Body` comparten estado sin prop drilling |
| **Container/Presentational** | `app/(portal)/quiz/page.tsx` + `components/quiz/QuizGrid.tsx` | Page = Container (fetch + estado); QuizGrid = Presentational (solo renderiza) |
| **Render Props Pattern** | `components/quiz/TimerBar.tsx` | `<Timer render={(time) => <TimerBar value={time} />} />` — lógica reutilizable con UI variable |

### Patrones de Renderizado (Next.js 16 App Router)

| Patrón | Sigla | Archivos que lo usan |
|--------|-------|----------------------|
| Client-Side Rendering | CSR | `quiz/[id]/play/page.tsx` · `assistant/page.tsx` · `profile/edit/page.tsx` |
| Server-Side Rendering | SSR | `dashboard/page.tsx` · `quiz/page.tsx` · `quiz/[id]/results/page.tsx` |
| Static Rendering | SSG | `(auth)/page.tsx` (landing) · `(auth)/terms/page.tsx` · `not-found.tsx` |
| Incremental Static Generation | ISR | `leaderboard/page.tsx` (revalidate: 60s) · `quiz/[id]/page.tsx` |
| Progressive Hydration | — | `components/ai/WeaknessChart.tsx` · `components/ai/AssistantChat.tsx` |
| Streaming SSR | — | `app/layout.tsx` con Suspense boundaries · `loading.tsx` en cada ruta |
| React Server Components | RSC | `components/layout/Navbar.tsx` · `components/layout/Footer.tsx` · `components/leaderboard/LeaderboardTable.tsx` |
| Selective Hydration | — | Todos los componentes sin `'use client'` — hidratados solo si hay interactividad |

### AI UI Patterns y React Stack 2026

| Patrón | Archivo | Descripción |
|--------|---------|-------------|
| Streaming Response | `components/portal/PortalTopbar.tsx` + `hooks/useSSE.ts` + `lib/bff/forward.ts` | Avisos en tiempo real por SSE (Last-Event-ID) a través del BFF |
| Optimistic Updates | `store/slices/quizSlice.ts` | Mensaje usuario en chat antes de respuesta IA |
| Error Recovery | `components/shared/ErrorBoundary.tsx` | Captura fallos IA con CTA de reintento |
| Server Actions | `app/(portal)/profile/edit/page.tsx` | Mutación de perfil sin Route Handler explícita |
| Partial Prerendering | `next.config.ts` (experimental.ppr) | Shell estático + zonas dinámicas en stream |
| use() hook | Server Components con fetch | Lectura de Promises en RSC sin useEffect |
| useTransition | `app/(portal)/quiz/[id]/play/page.tsx` | Navegación entre preguntas sin bloquear UI |

---

## Diccionario de Abreviaturas — Next.js

| Abrev. | Componente completo | Patrón de Diseño | Paradigma | Tecnología |
|--------|---------------------|------------------|-----------|------------|
| `btn` | Button | Decorator (CVA variantes) | Declarativo | shadcn/ui + Tailwind |
| `inp` | Input | Decorator (a11y label) | Declarativo | shadcn/ui |
| `crd` | Card | Composite Component | Declarativo | shadcn/ui + Radix |
| `dlg` | Dialog | Portal + Proxy (focus trap) | Declarativo | Radix UI |
| `bdg` | Badge | Value Object visual | Declarativo | shadcn/ui |
| `prg` | Progress | Observer (aria-live) | Reactivo | Radix UI |
| `skl` | Skeleton | Null Object (loading state) | Declarativo | shadcn/ui |
| `tst` | Toast | Observer (notificaciones) | Reactivo | shadcn/ui |
| `ttp` | Tooltip | Decorator (aria) | Declarativo | Radix UI |
| `sel` | Select | Adapter (Radix → dominio) | Declarativo | Radix UI |
| `tab` | Tabs | State (tab activo) | Reactivo | Radix UI |
| `avt` | Avatar | Null Object (fallback iniciales) | Declarativo | Radix UI |
| `sep` | Separator | Presentational | Declarativo | Radix UI |
| `lbl` | Label | Decorator (htmlFor a11y) | Declarativo | Radix UI |
| `qzc` | QuizCard | Presentational Component | Declarativo | React + Tailwind |
| `qzg` | QuizGrid | Container Component | Declarativo | React + Tailwind |
| `qnc` | QuestionCard | Compound Component | Declarativo + Funcional | React |
| `ano` | AnswerOption | Strategy (estado visual) | Declarativo | React |
| `tmb` | TimerBar | Observer (aria-live) | Reactivo | React |
| `scd` | ScoreDisplay | Presentational | Declarativo | React |
| `dfb` | DifficultyBadge | Value Object visual | Declarativo | React + Tailwind |
| `cti` | CategoryIcon | Adapter (Lucide → dominio) | Declarativo | Lucide React |
| `qzf` | QuizFilter | URL State Pattern | Declarativo | Next.js Router |
| `qzp` | QuizProgress | Derived State | Funcional | React |
| `fbp` | FeedbackPanel | Observer (SSE) | Reactivo | React + EventSource |
| `rcc` | RecommendationCard | Presentational | Declarativo | React |
| `wkc` | WeaknessChart | Data Visualization | Declarativo | Recharts |
| `asc` | AssistantChat | Observer + Iterator (stream) | Reactivo | React + SSE |
| `lbt` | LeaderboardTable | Iterator (paginación) | Declarativo | React |
| `rnb` | RankBadge | Value Object visual | Declarativo | React |
| `urr` | UserRankRow | Presentational | Declarativo | React |
| `lgf` | LoginForm | Template Method (RHF+Zod) | Funcional | React Hook Form + Zod |
| `rgf` | RegisterForm | Multi-step State Machine | Reactivo | React Hook Form |
| `oab` | OAuthButtons | Strategy (provider) | Declarativo | NextAuth.js |
| `prt` | ProtectedRoute | HOC + Guard Pattern | Funcional | Next.js middleware |
| `nvb` | Navbar | Composite | Declarativo | React + Tailwind |
| `sdb` | Sidebar | Composite + Collapse State | Reactivo | React + Redux uiSlice |
| `ftr` | Footer | Presentational | Declarativo | React |
| `thp` | ThemeProvider | Observer (context) | Reactivo | next-themes |
| `pgh` | PageHeader | Composite + Breadcrumb | Declarativo | React |
| `erb` | ErrorBoundary | Error Boundary (React pattern) | OOP | React class component |
| `ems` | EmptyState | Null Object Pattern | Funcional | React |
| `lsp` | LoadingSpinner | Skeleton Pattern | Declarativo | React + Tailwind |
| `pgn` | Pagination | Iterator + URL State | Funcional | Next.js Router |
| `cfd` | ConfirmDialog | Command + Confirmation | Reactivo | Radix UI |
| `srb` | SearchBar | Debounce Pattern | Funcional | React Hook |
| `seo` | SEOHead | Decorator (metadata) | Declarativo | Next.js Metadata API |
| `ath` | authSlice | CQRS-like (read/write sep) | Reactivo | Redux Toolkit |
| `qzs` | quizSlice | State Machine + Immer | Reactivo | Redux Toolkit |
| `uis` | uiSlice | Observer | Reactivo | Redux Toolkit |
| `tms` | timerSlice | State Machine | Reactivo | Redux Toolkit |

## Leyenda de Prácticas Aplicadas

| Práctica | Dónde se aplica en la estructura |
|----------|----------------------------------|
| **SOLID — SRP** | 1 archivo = 1 responsabilidad (slice, use-case, hook, componente) |
| **SOLID — OCP** | Atoms shadcn/ui extensibles sin modificar via CVA variantes |
| **SOLID — DIP** | RTK Query: componentes dependen de la API abstracta, no de fetch directo |
| **DRY** | Hooks reutilizables, store/api/ centralizados, shared-types package |
| **Clean Code** | Nombres descriptivos, hooks < 50 líneas, componentes < 100 líneas |
| **Type-Safe** | TS strict:true, Zod runtime validation, RTK Query endpoints tipados |
| **SEO** | generateMetadata por página, sitemap.ts, robots.ts, JSON-LD, OG images |
| **A11y WCAG 2.1 AA** | aria-* en todos atoms, focus trap dialogs, skip-to-content, jest-axe CI |
| **Responsive** | Tailwind sm/md/lg/xl/2xl en todos los layouts, sidebar colapsa mobile |
| **Performance** | SSR/SSG, lazy loading, code splitting, self-hosted fonts, WebP images |
| **Rutas protegidas** | middleware.ts verifica JWT antes del render, redirect a /login |
| **Rutas públicas** | Grupo `(auth)/` sin middleware, SSG donde sea posible |

---

## Herramientas de Testing

| Librería | Tipo de Prueba | Para qué sirve |
|----------|---------------|----------------|
| Jest | Unitarias + Integración | Framework de testing: describe/it/expect, mocks, coverage, jsdom |
| @testing-library/react | Unitarias | Testing de componentes por comportamiento (accesibilidad-first) |
| @testing-library/user-event | Unitarias | Simulación realista de eventos: click, type, keyboard, focus |
| @testing-library/jest-dom | Unitarias | Matchers DOM: toBeVisible, toHaveClass, toHaveTextContent |
| jest-axe | Unitarias (a11y) | Detecta violaciones WCAG en componentes dentro de Jest |
| MSW (Mock Service Worker) | Integración | Intercepta APIs en tests de componentes sin servidor real |
| Playwright | Funcionales + Usabilidad | E2E: chromium, firefox, webkit; flujos, teclado, responsive |
| @playwright/test | Funcionales | Runner oficial con assertions, fixtures, reporters, retries |
| axe-playwright | Usabilidad (a11y) | Scan WCAG 2.1 AA completo en páginas reales con Playwright |
| Lighthouse CI | Rendimiento + Usabilidad | Core Web Vitals automatizado en CI: LCP, FID, CLS, TTI |
| @next/bundle-analyzer | Rendimiento | Análisis visual del bundle JS para optimización de chunks |

## Validación de Datos

| Stack | Librería | Por qué |
|-------|----------|---------|
| Frontend Next.js | **Zod** | Type-safe runtime validation en cliente y servidor; schemas reutilizables con React Hook Form |

## Herramientas de Calidad de Código

| Herramienta | Para qué |
|-------------|----------|
| ESLint + eslint-config-next | Linter con reglas específicas Next.js + TypeScript |
| @typescript-eslint/parser | Parser TypeScript para ESLint |
| Prettier + prettier-plugin-tailwindcss | Formateador de código + ordenamiento automático de clases Tailwind |
| TypeScript strict:true | Type checking estático — sin any implícito, strictNullChecks |
| lint-staged + husky | Pre-commit hooks: ejecuta ESLint + Prettier antes de cada commit |
