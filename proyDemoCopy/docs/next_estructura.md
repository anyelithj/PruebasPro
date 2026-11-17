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

**Tecnologías:** Next.js 16 · React 19 · TypeScript 5 · Redux Toolkit 2 · Tailwind CSS 4 · tw-animate-css · shadcn/ui · Radix UI · Zod · React Hook Form · NextAuth.js · Playwright · Jest · MSW · ESLint · Prettier · Storybook 10 · TypeDoc

**Nota — MCP (Model Context Protocol):** El frontend Next.js 16 puede consumir herramientas expuestas por el AI Service (FastAPI) a través del protocolo MCP. MCP es un protocolo JSON-RPC 2.0 sobre HTTP/SSE definido por Anthropic para la comunicación entre agentes IA y clientes. En este proyecto el componente `AssistantChat.tsx` consume las `tools[]` del agente tutor vía el endpoint MCP del AI Service, con autenticación JWT.

**Nota — JSON:API:** JSON:API NO es un protocolo de API ni de comunicación. Es una convención de formato de respuesta REST (especificación jsonapi.org). Las respuestas del backend NestJS siguen un envelope `{ data, meta, errors }` compatible con JSON:API 1.1, procesado por RTK Query en el frontend.

---

## Estructura de Carpetas Completa

> Árbol generado desde la matriz `matriz_trazabilidad_tecnica_AulaDeIdiomas (6).xlsx` (hoja «📱 Next.js 16», columna «Carpeta / Archivo (FBA)»): ambos documentos listan los mismos archivos con los mismos nombres. La etiqueta `[CREAR | LISTAR | VER DETALLE | EDITAR | ELIMINAR]` indica qué operación CRUD atiende cada archivo; en la matriz no se repiten las carpetas porque ya aparecen en la ruta de cada archivo.

```
apps/frontend-next/                                       # MVC + Clean Architecture + Atomic Design: View=app/ · Controller=api/+hooks · Model=store/ · Infra=lib/
├── .lighthouseci/
│   └── flags-7d427255-2e9e-4340-bf50-b19580ad6ce0.json  # Configuración
├── playwright/
│   └── global-setup.ts
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
│   │   │   ├── actividades/
│   │   │   │   └── page.tsx                    # entrada «Actividades» del menú → abre la SECCIÓN completa del remoto Angular (Práctica, Juegos, Música, Diálogos, Poligl…
│   │   │   ├── admin/
│   │   │   │   ├── activities/         # Segmento de ruta (portal)/admin/activities — pestaña «Actividades» de Gestión (2026-10-19)
│   │   │   │   │   ├── editar/
│   │   │   │   │   │   └── [tab]/
│   │   │   │   │   │       └── [id]/
│   │   │   │   │   │           └── page.tsx    # Container (RSC: carga con el token en el servidor) + Presentational (ActivityEditForm, cliente) + Strategy (ACTIVITY_KIN…
│   │   │   │   │   ├── juegos/
│   │   │   │   │   │   ├── [type]/
│   │   │   │   │   │   │   └── page.tsx        # Container (RSC: carga con el token) + Presentational (GameCatalogForm, cliente) + Server Action
│   │   │   │   │   │   └── mazo/
│   │   │   │   │   │       └── [id]/
│   │   │   │   │   │           └── page.tsx    # SRP + mínimo privilegio (NestJS exige autor o ADMIN al guardar)
│   │   │   │   │   ├── lectura/
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   └── page.tsx        # Container (RSC: carga con el token en el servidor) + Presentational (ReadingEditor, cliente) + Server Actions
│   │   │   │   │   │   └── actions.ts          # editor de Gestión → Actividades → Lectura — metadatos, texto completo, frase a frase, completar IPA/traducción y publica…
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx            # «Crear actividad» con el paso «¿Qué vas a crear?» igual que Gestión → Recursos → Crear recurso
│   │   │   │   │   ├── ver/
│   │   │   │   │   │   └── [tab]/
│   │   │   │   │   │       └── [id]/
│   │   │   │   │   │           └── page.tsx    # MISMA disposición que el detalle de un recurso (/admin/curriculum/[id]): «Volver», cabecera con estado, «Así lo verá el …
│   │   │   │   │   ├── actions.ts              # eliminar una actividad de cualquier sección desde Gestión
│   │   │   │   │   └── page.tsx        # [LISTAR] accesos para administrar práctica, música, diálogos, poliglota, gramática y juegos
│   │   │   │   ├── certificados/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── page.tsx            # datos del alumno y del curso, SHA-256, estado, anclaje en Sepolia (Etherscan), código y auditoría
│   │   │   │   │   ├── nuevo/
│   │   │   │   │   │   └── page.tsx            # «Crear certificado» de Gestión → Certificados (mismo flujo que «Crear curso/recurso»: botón en la barra → página propia)
│   │   │   │   │   ├── actions.ts              # restablecer intentos de examen (ADMIN, incidencia técnica) y plantilla del PDF
│   │   │   │   │   ├── CertActionForm.tsx      # formulario genérico de Gestión → Certificados (emitir, reemitir, notas, revocar, solicitar revocación)
│   │   │   │   │   ├── CourseExamBanner.tsx    # Gestión → Exámenes con ?curso=<id> (tras crear/editar un curso) → revisar su examen final
│   │   │   │   │   └── page.tsx                # certificados emitidos, alumnos al 100 % (cierre académico y nota) y examen final de cada curso
│   │   │   │   ├── courses/                    # Segmento de ruta (portal)/admin/courses — LISTAR cursos de gestión (tabla con acciones por fila: editar, publicar, eliminar)
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── edit/               # Segmento de ruta (portal)/admin/courses/[id]/edit — EDITAR un curso (CourseForm mode="edit", cargado con sus datos)
│   │   │   │   │   │   │   └── page.tsx        # [EDITAR] EDITAR: carga el curso por id en el servidor y monta CourseForm mode="edit"
│   │   │   │   │   │   └── outline/
│   │   │   │   │   │       ├── actions.ts      # guardar el árbol y generar solo los huecos
│   │   │   │   │   │       └── page.tsx        # editor de la estructura Nivel → Módulo → Unidad → Lección
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
│   │   │   │   │   ├── certifications/
│   │   │   │   │   │   └── page.tsx            # catálogo de certificaciones (especificaciones públicas) + generador de práctica original
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
│   │   │   │   │   │       ├── loading.tsx     # mismo indicador de carga que /dashboard/admin en todo el portal (antes esqueleto propio)
│   │   │   │   │   │       └── page.tsx        # [VER DETALLE] VER DETALLE de una lección o material (lector PDF y audio, solo lectura)
│   │   │   │   │   ├── path/
│   │   │   │   │   │   ├── [lessonId]/
│   │   │   │   │   │   │   └── page.tsx        # contenido de una lección de la ruta del curso + navegación de la línea de tiempo
│   │   │   │   │   │   └── actions.ts          # completa la lección y lleva a la siguiente
│   │   │   │   │   ├── temario/
│   │   │   │   │   │   └── page.tsx            # el TEMARIO en su propia ruta (antes compartía página con «Materiales adicionales» en /lessons/:materialId)
│   │   │   │   │   ├── loading.tsx             # Loading skeleton /courses/:id: placeholder hero + descripción mientras SSR carga
│   │   │   │   │   └── page.tsx                # [VER DETALLE] VER DETALLE de un curso: temario, materiales y compra/inscripción
│   │   │   │   ├── favoritos/
│   │   │   │   │   └── page.tsx                # «Mis favoritos» del estudiante — cursos guardados con ⭐, paginados en el SERVIDOR (GET /me/favorites)
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
│   │   │   │   │   ├── ChangePasswordForm.tsx  # tarjeta "Cambiar contraseña" (actual + nueva + repetir)
│   │   │   │   │   ├── page.tsx                # [EDITAR] EDITAR: carga el perfil propio y monta ProfileEditForm mode="edit" + AvatarCard
│   │   │   │   │   ├── ProfileEditForm.tsx     # [VER DETALLE, EDITAR] Formulario de perfil (DRY): mode="edit" desde profile/edit; mode="view" reutilizable en el perfil público; envía a updateProfileAction (actions.ts)
│   │   │   │   │   └── TwoFactorCard.tsx       # tarjeta «Verificación en dos pasos» (código OTP al correo)
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
│   │   │   │   ├── examen/
│   │   │   │   │   ├── curso/
│   │   │   │   │   │   └── [courseId]/
│   │   │   │   │   │       └── page.tsx        # /quiz/examen/curso/:courseId — examen final del curso (se genera solo al llegar al 100 %) → aprobar emite el certificado
│   │   │   │   │   └── nivel/
│   │   │   │   │       └── page.tsx            # /quiz/examen/nivel?language=en&level=A1 — se llega desde la tarjeta «Examen Nivel» de Exámenes (ya no hay selector apart…
│   │   │   │   ├── loading.tsx                 # Loading skeleton: spinner mínimo
│   │   │   │   └── page.tsx                    # [LISTAR] LISTAR: SSR + paginación + filtros en la URL
│   │   │   ├── resources/                      # Segmento de ruta (portal)/resources — LISTAR los recursos publicados por idioma y nivel (estudiante, solo lectura)
│   │   │   │   ├── fonema/
│   │   │   │   │   └── page.tsx                # DETALLE de un fonema al pulsar su tarjeta en Recursos › Pronunciación — explicación, posición de la boca, 10 palabras co…
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
│   │   │   ├── layout.tsx                      # Layout protegido: sidebar + navbar + auth check
│   │   │   └── loading.tsx                     # mismo indicador de carga que /dashboard/admin en todo el portal (antes esqueleto propio)
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
│   │   │   │   ├── 2fa/
│   │   │   │   │   └── verify/
│   │   │   │   │       └── route.ts            # segundo paso del login con 2FA (código OTP del correo)
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
│   │   │   │   ├── [courseId]/
│   │   │   │   │   ├── favorite/
│   │   │   │   │   │   └── route.ts            # PUT (guardar en «Mis favoritos») · DELETE (quitar) → NestJS, ambos idempotentes
│   │   │   │   │   ├── materials/              # Route Handlers (BFF) de /api/courses/[courseId]/materials
│   │   │   │   │   │   ├── [id]/               # Route Handlers (BFF) de /api/courses/[courseId]/materials/[id]
│   │   │   │   │   │   │   ├── file/           # Route Handlers (BFF) de /api/courses/[courseId]/materials/[id]/file
│   │   │   │   │   │   │   │   └── route.ts    # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   │   │   │   └── route.ts        # [VER DETALLE, EDITAR, ELIMINAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   │   │   ├── link/
│   │   │   │   │   │   │   └── route.ts        # adjunta un enlace externo (YouTube, artículo, podcast) como material
│   │   │   │   │   │   └── route.ts            # [CREAR, LISTAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   │   ├── purchase/               # Route Handlers (BFF) de /api/courses/[courseId]/purchase
│   │   │   │   │   │   └── route.ts            # [CREAR] Compra de demostración del checkout Angular cuando el servidor no tiene claves de Stripe
│   │   │   │   │   └── reaction/               # Route Handlers (BFF) de /api/courses/[courseId]/reaction
│   │   │   │   │       └── route.ts            # [EDITAR] Proxy a NestJS con cookie httpOnly → Bearer
│   │   │   │   ├── draft/
│   │   │   │   │   ├── topic/
│   │   │   │   │   │   └── route.ts            # BFF → NestJS POST /courses/draft/topic (explicación de un subtema del temario con IA)
│   │   │   │   │   └── route.ts                # BFF → NestJS POST /courses/draft (borrador IA: título + descripción Markdown + etiquetas)
│   │   │   │   └── import/
│   │   │   │       └── route.ts                # «Importar contenido del curso» — archivo (PDF con OCR de escaneos, Word, Excel, imagen, audio…) o enlace → texto + Markd…
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
│   │   │   │   ├── by-topic/
│   │   │   │   │   └── route.ts                # recursos agrupados por tema → NestJS GET /curriculum/by-topic (el selector de contenidos de Práctica en Angular lo usa)
│   │   │   │   ├── export/
│   │   │   │   │   └── route.ts                # descarga de recursos (PDF, Word, Excel o CSV) → NestJS GET /curriculum/export con la cookie httpOnly como Bearer
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
│   │   │   ├── media/
│   │   │   │   └── extract-text/
│   │   │   │       └── route.ts                # texto de un ARCHIVO (multipart: PDF, Word, texto, imagen con OCR) o de un ENLACE (JSON { url })
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
│   │   │       ├── exams/
│   │   │       │   ├── course/
│   │   │       │   │   └── [courseId]/
│   │   │       │   │       └── route.ts
│   │   │       │   └── level/
│   │   │       │       └── route.ts            # estado del examen de nivel
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
│   │   ├── activities/
│   │   │   ├── ActivityCreateForm.tsx          # pasos «Datos» y «Contenido» de Gestión → Crear actividad — TODO en la página (sin ventanas modales), igual que «Crear re…
│   │   │   ├── ActivityEditForm.tsx            # «Editar» de Gestión → Actividades (Práctica, Diálogos) en Next.js — antes abría el editor del remoto Angular (otra inter…
│   │   │   ├── ActivityPreview.tsx             # «Así lo verá el estudiante» en la página de revisión de Gestión → Actividades — en Next.js (antes un <iframe> con la
│   │   │   ├── DeckEditForm.tsx                # «Editar» de un juego con material propio (Gestión → Actividades → Juegos) — antes la fila no tenía edición y había que b…
│   │   │   ├── DraftEditor.tsx                 # lista editable de filas (ítems, turnos, ejemplos, conceptos) — los campos los declara la estrategia del tipo
│   │   │   ├── FieldInput.tsx                  # pinta UN campo declarado en la estrategia del tipo (texto, área, select, enlace o casilla) → el formulario de «Crear act…
│   │   │   ├── GameCatalogForm.tsx             # «Editar juego» del catálogo (título y descripción que ven los estudiantes en /juegos)
│   │   │   ├── MediaUpload.tsx                 # audio opcional de una actividad (Diálogos: cada turno se sincroniza) — antes vivía en el panel «Actividad creada», que s…
│   │   │   └── SourceImport.tsx                # origen ÚNICO de «Importar» en Crear actividad — archivo (Excel, CSV, Word, PDF, texto, imagen con OCR, audio/video) o en…
│   │   ├── admin/
│   │   │   ├── ActivityLangLevel.tsx           # paso «¿Para qué idioma y nivel?» de Gestión → Crear actividad
│   │   │   ├── DeactivateUserButton.stories.tsx  # [Sprint 11.2] Storybook: DeactivateUserButton (default · deshabilitado · confirmación) con axe
│   │   │   ├── DeactivateUserButton.tsx        # [ELIMINAR] DeactivateUserButton (Client/Presentational)
│   │   │   ├── FilterPanel.tsx                 # panel de filtros ÚNICO de Gestión (Recursos, Actividades, Cursos, Certificados) y de las secciones del estudiante (Recur…
│   │   │   ├── FilterSelect.tsx                # <select> de filtro con etiqueta visible para los formularios GET de Gestión (Recursos y Actividades)
│   │   │   ├── RowActions.stories.tsx          # [Sprint 11.2] Storybook: RowActions (default · deshabilitado · confirmación) con axe
│   │   │   └── RowActions.tsx                  # RowActions (Client/Presentational)
│   │   ├── ai/                                 # Molecules — dominio IA
│   │   │   ├── AssistantChat.stories.tsx       # [Sprint 11.2] Storybook: AssistantChat (default · cargando · vacío · error) con axe
│   │   │   ├── AssistantChat.tsx               # asc: chat tutor IA con SSE stream · ⚠ archivo vacío (marcador) · ⚠ DUPLICADO: el chat del tutor vive en Angular (features/assistant, módulo Assistant) → eliminar este marcador
│   │   │   ├── FeedbackPanel.stories.tsx       # [Sprint 11.2] Storybook: FeedbackPanel (default · cargando · vacío · error) con axe
│   │   │   ├── FeedbackPanel.tsx               # fbp: panel feedback post-quiz con secciones
│   │   │   ├── RecommendationCard.stories.tsx  # [Sprint 11.2] Storybook: RecommendationCard (default · cargando · vacío · error) con axe
│   │   │   ├── RecommendationCard.tsx          # rcc: sugerencia de estudio · ⚠ archivo vacío (marcador) · ⚠ DUPLICADO: las recomendaciones viven en Angular (features/feedback, módulo Feedback) → eliminar este marcador
│   │   │   ├── StudyPlan.tsx                   # plan de estudio ordenado, agrupado por tema, con el tiempo estimado
│   │   │   ├── WeaknessChart.stories.tsx       # [Sprint 11.2] Storybook: WeaknessChart (default · cargando · vacío · error) con axe
│   │   │   └── WeaknessChart.tsx               # wkc: gráfico recharts áreas de mejora
│   │   ├── auth/                               # Molecules — dominio Auth
│   │   │   ├── ForgotPasswordForm.stories.tsx  # [Sprint 11.2] Storybook: ForgotPasswordForm (default · con errores de Zod · enviando · error del servidor) con axe
│   │   │   ├── ForgotPasswordForm.tsx          # [CREAR, VER DETALLE, EDITAR] ForgotPasswordForm (Client/Presentational)
│   │   │   ├── LoginForm.stories.tsx           # [Sprint 11.2] Storybook: LoginForm (default · con errores de Zod · enviando · error del servidor) con axe
│   │   │   ├── LoginForm.tsx                   # lgf: form + Zod + RHF + error messages a11y
│   │   │   ├── LogoutButton.stories.tsx        # [Sprint 11.2] Storybook: LogoutButton (default · con errores de Zod · enviando · error del servidor) con axe
│   │   │   ├── LogoutButton.tsx                # [ELIMINAR] LogoutButton: invoca /api/auth/logout y redirige
│   │   │   ├── OAuthButtons.stories.tsx        # [Sprint 11.2] Storybook: OAuthButtons (default · con errores de Zod · enviando · error del servidor) con axe
│   │   │   ├── OAuthButtons.tsx                # oab: Google + GitHub con aria-label
│   │   │   ├── ProtectedRoute.tsx              # prt: HOC redirect si no auth (Guard pattern) · ⚠ archivo vacío (marcador)
│   │   │   ├── RegisterForm.stories.tsx        # [Sprint 11.2] Storybook: RegisterForm (default · con errores de Zod · enviando · error del servidor) con axe
│   │   │   ├── RegisterForm.tsx                # [CREAR] rgf: multi-step + validación por paso
│   │   │   ├── ResetPasswordForm.stories.tsx   # [Sprint 11.2] Storybook: ResetPasswordForm (default · con errores de Zod · enviando · error del servidor) con axe
│   │   │   ├── ResetPasswordForm.tsx           # [EDITAR] ResetPasswordForm (Client/Presentational)
│   │   │   ├── SessionWatcher.tsx              # si la sesión terminó de verdad (refresh vencido o revocado) lleva al login sin esperar a que falle una acción, y al volv…
│   │   │   ├── VerifyEmailForm.stories.tsx     # [Sprint 11.2] Storybook: VerifyEmailForm (default · con errores de Zod · enviando · error del servidor) con axe
│   │   │   └── VerifyEmailForm.tsx             # [VER DETALLE] VerifyEmailForm (Client/Presentational)
│   │   ├── courses/
│   │   │   ├── CourseActions.stories.tsx       # [Sprint 11.2] Storybook: CourseActions (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── CourseActions.tsx               # CourseActions (Client/Presentational)
│   │   │   ├── CourseBadge.stories.tsx         # [Sprint 11.2] Storybook: CourseBadge (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── CourseBadge.tsx                 # CourseBadge (Client/Presentational)
│   │   │   ├── CourseCard.stories.tsx          # [Sprint 11.2] Storybook: CourseCard (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── CourseCard.tsx                  # CourseCard (Client/Presentational)
│   │   │   ├── CourseFilter.stories.tsx        # [Sprint 11.2] Storybook: CourseFilter (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── CourseFilter.tsx                # CourseFilter (Client/Presentational)
│   │   │   ├── CourseGrid.stories.tsx          # [Sprint 11.2] Storybook: CourseGrid (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── CourseGrid.tsx                  # CourseGrid (Client/Presentational)
│   │   │   ├── CourseLesson.stories.tsx        # [Sprint 11.2] Storybook: CourseLesson (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── CourseLesson.tsx                # CourseLesson (Client/Presentational) · si la URL firmada del video caduca, la vuelve a pedir y retoma el segundo (Sprint 6.7)
│   │   │   ├── CourseMaterials.stories.tsx     # [Sprint 11.2] Storybook: CourseMaterials (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── CourseMaterials.tsx             # CourseMaterials (Client/Presentational)
│   │   │   ├── CourseOutlineEditor.tsx         # editor de la estructura Nivel → Módulo → Unidad → Lección con huecos y generación con IA
│   │   │   ├── CoursePrice.stories.tsx         # [Sprint 11.2] Storybook: CoursePrice (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── CoursePrice.tsx                 # CoursePrice (Client/Presentational)
│   │   │   ├── CourseProgressProvider.tsx      # UNA sola fuente del avance en la página de la lección → el temario (línea de tiempo) y los recursos se mueven JUNTOS
│   │   │   ├── CourseReactionBar.tsx           # barra ÚNICA ⭐ Favorito · 👍 Me gusta · ❤️ Me encanta → la usan la card del catálogo, el detalle y «Mis favoritos»
│   │   │   ├── CourseSyllabus.tsx              # TEMARIO del curso en su página = subtemas desplegables (definición, uso, reglas, ejemplos, videos de YouTube)
│   │   │   ├── CourseSyllabusEditor.tsx        # en pantalla «## » = TEMA (p. ej. «Inglés A2 · Elemental») y «### » = SUBTEMA («Pasado simple: was / were») · el formato …
│   │   │   ├── CourseTimeline.tsx              # ruta del curso como línea de tiempo Nivel → Módulo → Unidad → Lección, con la SIGUIENTE lección destacada
│   │   │   ├── FinalExamGate.tsx               # examen final al pie del temario — bloqueado hasta el 100 %;
│   │   │   ├── LessonSyllabus.tsx              # «Temario del curso» en la página de la lección con el MISMO diseño que «Recursos» (sección con borde superior + <h2> + t…
│   │   │   ├── PdfReader.stories.tsx           # [Sprint 11.2] Storybook: PdfReader (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   ├── PdfReader.tsx                   # PdfReader (Client/Presentational)
│   │   │   ├── ProgressBar.tsx                 # barra de progreso única de los cursos (etiqueta + % + detalle opcional)
│   │   │   ├── SyllabusList.stories.tsx        # [Sprint 11.2] Storybook: SyllabusList (default · gratuito/de pago · cargando · vacío) con axe
│   │   │   └── SyllabusList.tsx                # [LISTAR] SyllabusList (Client/Presentational)
│   │   ├── curriculum/
│   │   │   ├── CatalogCreatePanels.stories.tsx  # [Sprint 11.2] Storybook: CatalogCreatePanels (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── CatalogCreatePanels.tsx         # CatalogCreatePanels (Client/Presentational)
│   │   │   ├── CertificationPracticePanel.tsx  # genera ítems ORIGINALES de preparación y permite guardar los elegidos como «Generado por IA»
│   │   │   ├── ContentEditor.stories.tsx       # [Sprint 11.2] Storybook: ContentEditor (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── ContentEditor.tsx               # ContentEditor (Client/Presentational)
│   │   │   ├── ContradictionScanButton.stories.tsx  # [Sprint 11.2] Storybook: ContradictionScanButton (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── ContradictionScanButton.tsx     # [EDITAR] «Comparar fuentes» del idioma filtrado (Server Action + aria-live)
│   │   │   ├── CurriculumBadges.stories.tsx    # [Sprint 11.2] Storybook: CurriculumBadges (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── CurriculumBadges.tsx            # CurriculumBadges (Client/Presentational)
│   │   │   ├── CurriculumItemForm.stories.tsx  # [Sprint 11.2] Storybook: CurriculumItemForm (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── CurriculumItemForm.tsx          # [CREAR, VER DETALLE, EDITAR] Formulario ÚNICO de recurso curricular (DRY): mode="create" = en blanco · mode="edit" = cargado con los datos · mode="view" = solo lectura. Las páginas new/, [id]/ y [id]/edit/ solo cargan los datos y eligen el modo; el envío va a la Server Action del módulo (createCurriculumItemAction / updateCurriculumItemAction)
│   │   │   ├── DownloadMenu.tsx                # descarga TODO el contenido filtrado (un tema, un tipo…) en PDF, Word, Excel o CSV — antes solo había una plantilla CSV v…
│   │   │   ├── EmojiPicker.stories.tsx         # [Sprint 11.2] Storybook: EmojiPicker (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── EmojiPicker.tsx                 # Next.js: Client Component → modal interactivo con búsqueda
│   │   │   ├── GenerationTrace.stories.tsx     # [Sprint 11.2] Storybook: GenerationTrace (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── GenerationTrace.tsx             # GenerationTrace (Client/Presentational)
│   │   │   ├── ImportPanel.stories.tsx         # [Sprint 11.2] Storybook: ImportPanel (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── ImportPanel.tsx                 # [CREAR] Next.js: Client Component → lee archivos locales con APIs del navegador
│   │   │   ├── MouthMedia.tsx                  # imagen o video de la BOCA en «Cómo se pronuncia» (fichas de pronunciación)
│   │   │   ├── MouthMediaField.tsx             # subir una imagen o un video de la BOCA para «Cómo se pronuncia» (editor de fichas de pronunciación)
│   │   │   ├── PhonemeSheet.tsx                # ficha de un FONEMA (símbolo, palabra clave con audio UK/US, explicación, palabras, frases, cómo se escribe,
│   │   │   ├── ResourceBackLink.tsx            # «Volver a vocabulario / regla gramatical / pronunciación…» según el TIPO del recurso abierto (antes siempre «Volver a re…
│   │   │   ├── ResourcePreview.stories.tsx     # [Sprint 11.2] Storybook: ResourcePreview (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── ResourcePreview.tsx             # ResourcePreview (Client/Presentational)
│   │   │   ├── ReviewStatusActions.stories.tsx  # [Sprint 11.2] Storybook: ReviewStatusActions (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── ReviewStatusActions.tsx         # [EDITAR] ReviewStatusActions (Client/Presentational)
│   │   │   ├── SearchSelect.stories.tsx        # [Sprint 11.2] Storybook: SearchSelect (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── SearchSelect.tsx                # [LISTAR] SearchSelect (Client/Presentational)
│   │   │   ├── SpeakButton.stories.tsx         # [Sprint 11.2] Storybook: SpeakButton (default · borrador/aprobado · con error · solo lectura) con axe
│   │   │   ├── SpeakButton.tsx                 # Next.js: Client Component → usa la Web Speech API del navegador
│   │   │   └── TopicSelect.tsx                 # el campo «Tema» de «Crear recurso» extraído para reutilizarlo en «Crear actividad» (antes Actividades tenía un <input> l…
│   │   ├── landing/
│   │   │   ├── CtaFooter.stories.tsx           # [Sprint 11.2] Storybook: CtaFooter (default · tema claro y oscuro · móvil) con axe
│   │   │   ├── CtaFooter.tsx                   # CTA final + pie con enlaces legales
│   │   │   ├── FaqSection.stories.tsx          # [Sprint 11.2] Storybook: FaqSection (default · tema claro y oscuro · móvil) con axe
│   │   │   ├── FaqSection.tsx                  # FAQ breve con JSON-LD FAQPage
│   │   │   ├── Hero.stories.tsx                # [Sprint 11.2] Storybook: Hero (default · tema claro y oscuro · móvil) con axe
│   │   │   ├── Hero.tsx                        # Hero (propuesta de valor + CTA)
│   │   │   ├── HowItWorks.stories.tsx          # [Sprint 11.2] Storybook: HowItWorks (default · tema claro y oscuro · móvil) con axe
│   │   │   ├── HowItWorks.tsx                  # cómo funciona (3 pasos)
│   │   │   ├── LanguagesGrid.stories.tsx       # [Sprint 11.2] Storybook: LanguagesGrid (default · tema claro y oscuro · móvil) con axe
│   │   │   ├── LanguagesGrid.tsx               # siete idiomas
│   │   │   ├── LevelsMcer.stories.tsx          # [Sprint 11.2] Storybook: LevelsMcer (default · tema claro y oscuro · móvil) con axe
│   │   │   ├── LevelsMcer.tsx                  # niveles A1–C2
│   │   │   ├── LocalAiPrivacy.stories.tsx      # [Sprint 11.2] Storybook: LocalAiPrivacy (default · tema claro y oscuro · móvil) con axe
│   │   │   ├── LocalAiPrivacy.tsx              # IA local y privacidad
│   │   │   ├── Pricing.stories.tsx             # [Sprint 11.2] Storybook: Pricing (default · tema claro y oscuro · móvil) con axe
│   │   │   └── Pricing.tsx                     # planes y métodos de pago (tarjeta, cripto)
│   │   ├── language/
│   │   │   ├── AccentPreference.stories.tsx    # [Sprint 11.2] Storybook: AccentPreference (default · UK/US · con y sin IPA) con axe
│   │   │   ├── AccentPreference.tsx            # lee y escribe la cookie de acento UK/US compartida con Angular · host de un remoto Angular (transversal)
│   │   │   ├── IpaChart.tsx                    # «Alfabeto fonético (IPA)» en Recursos › Pronunciación — temas en píldoras (anclas) + por fonema: símbolo, ejemplo con au…
│   │   │   ├── IpaTextHost.tsx                 # monta <aula-ipa-text> con respaldo de texto plano si el remoto no responde · host de un remoto Angular (transversal)
│   │   │   ├── PolyglotNavLink.stories.tsx     # [Sprint 11.2] Storybook: PolyglotNavLink (default · UK/US · con y sin IPA) con axe
│   │   │   ├── PolyglotNavLink.tsx             # opción «Poliglota» en la sección de recursos, junto a los siete idiomas · host de un remoto Angular (transversal)
│   │   │   ├── ResourceVocabularyField.stories.tsx  # [Sprint 11.2] Storybook: ResourceVocabularyField (default · UK/US · con y sin IPA) con axe
│   │   │   ├── ResourceVocabularyField.tsx     # campo de vocabulario del editor de recursos: al agregar un término muestra traducción e IPA UK/US editables
│   │   │   ├── TopicTitle.stories.tsx  # [Sprint 11.2] Storybook: TopicTitle (default · UK/US · con y sin IPA) con axe
│   │   │   ├── TopicTitle.tsx          # tema en el idioma estudiado con IPA, audio y traducción · 2026-10-19
│   │   │   └── WordLookupHost.tsx              # envuelve un texto con <aula-word-lookup> y deja el texto plano si el remoto no responde · host de un remoto Angular (transversal)
│   │   ├── layout/                             # Organisms — estructura global
│   │   │   ├── Footer.stories.tsx              # [Sprint 11.2] Storybook: Footer (default · por rol · móvil) con axe
│   │   │   ├── Footer.tsx                      # ftr: links semánticos + copyright · ⚠ archivo vacío (marcador)
│   │   │   ├── Navbar.stories.tsx              # [Sprint 11.2] Storybook: Navbar (default · por rol · móvil) con axe
│   │   │   ├── Navbar.tsx                      # nvb: nav + skip-to-content + user menu + dark mode · ⚠ archivo vacío (marcador)
│   │   │   ├── PageHeader.stories.tsx          # [Sprint 11.2] Storybook: PageHeader (default · por rol · móvil) con axe
│   │   │   ├── PageHeader.tsx                  # pgh: breadcrumb (aria) + título + acciones · ⚠ archivo vacío (marcador)
│   │   │   ├── PreferencesProvider.tsx         # PreferencesProvider (Client): tema e idioma; emite aula:theme-changed / aula:locale-changed para los remotos Angular
│   │   │   ├── PublicNavbar.stories.tsx        # [Sprint 11.2] Storybook: PublicNavbar (default · por rol · móvil) con axe
│   │   │   ├── PublicNavbar.tsx                # PublicNavbar (Client/Presentational)
│   │   │   ├── Sidebar.stories.tsx             # [Sprint 11.2] Storybook: Sidebar (default · por rol · móvil) con axe
│   │   │   ├── Sidebar.tsx                     # sdb: nav lateral + collapse mobile + aria-expanded · ⚠ archivo vacío (marcador)
│   │   │   └── ThemeProvider.tsx               # thp: next-themes dark/light sin flash · ⚠ archivo vacío (marcador)
│   │   ├── leaderboard/                        # Molecules — dominio Ranking
│   │   │   ├── LeaderboardTable.stories.tsx    # [Sprint 11.2] Storybook: LeaderboardTable (default · posición propia · vacío) con axe
│   │   │   ├── LeaderboardTable.tsx            # [LISTAR] lbt: tabla ranking paginada + aria-sort · ⚠ archivo vacío (marcador)
│   │   │   ├── RankBadge.stories.tsx           # [Sprint 11.2] Storybook: RankBadge (default · posición propia · vacío) con axe
│   │   │   ├── RankBadge.tsx                   # rnb: medallas #1 #2 #3 con aria-label · ⚠ archivo vacío (marcador)
│   │   │   ├── UserRankRow.stories.tsx         # [Sprint 11.2] Storybook: UserRankRow (default · posición propia · vacío) con axe
│   │   │   └── UserRankRow.tsx                 # urr: fila de usuario con avatar + score · ⚠ archivo vacío (marcador)
│   │   ├── portal/                             # Organisms del portal: barra superior, menú lateral y paneles
│   │   │   ├── AnalyticsFilters.stories.tsx    # [Sprint 11.2] Storybook: AnalyticsFilters (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── AnalyticsFilters.tsx            # AnalyticsFilters (Client/Presentational)
│   │   │   ├── ChartBars.stories.tsx           # [Sprint 11.2] Storybook: ChartBars (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── ChartBars.tsx                   # ChartBars (Client/Presentational)
│   │   │   ├── Donut.stories.tsx               # [Sprint 11.2] Storybook: Donut (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── Donut.tsx                       # Donut (Client/Presentational)
│   │   │   ├── Dropdown.stories.tsx            # [Sprint 11.2] Storybook: Dropdown (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── Dropdown.tsx                    # Next.js: Client Component → estado de apertura y eventos del documento
│   │   │   ├── ManagementHeader.stories.tsx    # [Sprint 11.2] Storybook: ManagementHeader (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── ManagementHeader.tsx            # Next.js: navegación cliente con prefetch; las pestañas son enlaces reales (funcionan sin JS)
│   │   │   ├── MobileNav.stories.tsx           # [Sprint 11.2] Storybook: MobileNav (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── MobileNav.tsx                   # MobileNav (Client/Presentational)
│   │   │   ├── Panel.stories.tsx               # [Sprint 11.2] Storybook: Panel (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── Panel.tsx                       # Panel
│   │   │   ├── portal-role.ts                  # Rol de UI del portal: módulo neutro (sin "use client") → lo usan Server y Client Components
│   │   │   ├── PortalSidebar.stories.tsx       # [Sprint 11.2] Storybook: PortalSidebar (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── PortalSidebar.tsx               # PortalSidebar (Client): lee la navegación compartida de packages/shared-nav (@aula/shared-nav)
│   │   │   ├── PortalToolbar.stories.tsx       # [Sprint 11.2] Storybook: PortalToolbar (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── PortalToolbar.tsx               # PortalToolbar (Client/Presentational)
│   │   │   ├── PortalTopbar.stories.tsx        # [Sprint 11.2] Storybook: PortalTopbar (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── PortalTopbar.tsx                # PortalTopbar (Client/Presentational)
│   │   │   ├── quiz-format.ts                  # Delegado al SSOT: etiqueta + banda MCER/CEFR
│   │   │   ├── RecItem.stories.tsx             # [Sprint 11.2] Storybook: RecItem (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── RecItem.tsx                     # RecItem
│   │   │   ├── StatCard.stories.tsx            # [Sprint 11.2] Storybook: StatCard (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── StatCard.tsx                    # StatCard (Client/Presentational)
│   │   │   ├── Tag.stories.tsx                 # [Sprint 11.2] Storybook: Tag (default · sin datos · tema claro y oscuro) con axe
│   │   │   ├── Tag.tsx                         # Tag
│   │   │   ├── Topbar.stories.tsx              # [Sprint 11.2] Storybook: Topbar (default · sin datos · tema claro y oscuro) con axe
│   │   │   └── Topbar.tsx                      # Topbar de página: título + subtítulo + acciones propias de cada dashboard
│   │   ├── quiz/                               # Molecules — dominio Quiz
│   │   │   ├── AnswerOption.stories.tsx        # [Sprint 11.2] Storybook: AnswerOption (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── AnswerOption.tsx                # ano: radio accesible con estado visual
│   │   │   ├── CategoryIcon.stories.tsx        # [Sprint 11.2] Storybook: CategoryIcon (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── CategoryIcon.tsx                # cti: icono Lucide + aria-label descriptivo
│   │   │   ├── DifficultyBadge.stories.tsx     # [Sprint 11.2] Storybook: DifficultyBadge (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── DifficultyBadge.tsx             # dfb: nivel dificultad con color + texto (no solo color)
│   │   │   ├── ExamClock.tsx                   # cuenta atrás del tiempo TOTAL del examen (hora fin del servidor = inicio del intento + minutos) → al llegar a 0 entrega …
│   │   │   ├── ExamStatusCard.tsx              # estado del examen final de un curso o de un examen de nivel → reglas, intentos y botón Empezar/Continuar
│   │   │   ├── QuestionCard.stories.tsx        # [Sprint 11.2] Storybook: QuestionCard (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── QuestionCard.tsx                # qnc: pregunta + opciones + keyboard nav (a11y)
│   │   │   ├── QuizActions.stories.tsx         # [Sprint 11.2] Storybook: QuizActions (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── QuizActions.tsx                 # QuizActions: botones acciones quiz para docente/admin
│   │   │   ├── QuizAdminTable.stories.tsx      # [Sprint 11.2] Storybook: QuizAdminTable (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── QuizAdminTable.tsx              # [LISTAR] QuizAdminTable (Client/Presentational)
│   │   │   ├── QuizCard.stories.tsx            # [Sprint 11.2] Storybook: QuizCard (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── QuizCard.tsx                    # qzc: tarjeta resumen con link semántico
│   │   │   ├── QuizFilter.stories.tsx          # [Sprint 11.2] Storybook: QuizFilter (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── QuizFilter.tsx                  # qzf: filtros en URL (URL State Pattern) · ⚠ archivo vacío (marcador)
│   │   │   ├── QuizFilters.tsx                 # panel de filtros de Gestión → Exámenes, igual que Cursos, Recursos y Actividades (buscar · nivel · habilidad · estado + …
│   │   │   ├── QuizForm.stories.tsx            # [Sprint 11.2] Storybook: QuizForm (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── QuizForm.tsx                    # [CREAR, VER DETALLE, EDITAR] Formulario ÚNICO de examen (DRY): mode="create" = en blanco · mode="edit" = cargado con los datos · mode="view" = solo lectura. Las páginas new/, [id]/ y [id]/edit/ solo cargan los datos y eligen el modo; el envío va a la Server Action del módulo (createQuizAction / updateQuizAction)
│   │   │   ├── QuizGrid.stories.tsx            # [Sprint 11.2] Storybook: QuizGrid (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── QuizGrid.tsx                    # qzg: grid responsivo sm:1 md:2 lg:3 cols
│   │   │   ├── QuizProgress.stories.tsx        # [Sprint 11.2] Storybook: QuizProgress (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── QuizProgress.tsx                # qzp: N/total preguntas con aria-label
│   │   │   ├── ScoreDisplay.stories.tsx        # [Sprint 11.2] Storybook: ScoreDisplay (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   ├── ScoreDisplay.tsx                # scd: puntuación animada (respeta reduced-motion)
│   │   │   ├── TimerBar.stories.tsx            # [Sprint 11.2] Storybook: TimerBar (default · respondido · correcto/incorrecto · cargando) con axe
│   │   │   └── TimerBar.tsx                    # tmb: aria-live="polite" + aria-valuenow
│   │   ├── reading/
│   │   │   ├── ReadingEditor.tsx               # editor de Gestión — datos, texto completo (re-divide en frases), frases con traducción/IPA editables, completar IPA/trad…
│   │   │   ├── SentenceRow.tsx                 # una frase editable (texto, traducción, IPA UK/US) con «Escuchar» (GET /api/audio, misma caché que diálogos y vocabulario…
│   │   │   └── WordCard.tsx                    # tarjeta de la referencia docs/WhatsApp Image 2026-10-30 → 🔊 palabra · IPA · traducción centradas + pie a dos colores «Ap…
│   │   ├── shared/                             # Shared UI — cross-domain
│   │   │   ├── AccentSwitch.stories.tsx        # interruptor de acento UK/US (role="switch")
│   │   │   ├── AccentSwitch.tsx                # interruptor UK/US del inglés, espejo de <aula-accent-switch> de Angular (mismo aspecto, misma cookie y mismo evento)
│   │   │   ├── AngularElements.tsx          # Carga /ng/main.js y /ng/styles.css una vez → <aula-exportar>, <aula-campana>
│   │   │   ├── BackLink.stories.tsx            # enlace «volver» único del sitio (flecha + texto)
│   │   │   ├── BackLink.tsx                    # enlace «volver» ÚNICO del sitio — icono de flecha + texto, sin aspecto de botón (antes cada página usaba «← …» con estil…
│   │   │   ├── BusyOverlay.stories.tsx         # Capa de «trabajando…» durante navegaciones y acciones lentas
│   │   │   ├── BusyOverlay.tsx                 # capa con el MISMO indicador de carga (LoadingSpinner, «Cargando… puede tardar unos minutos») mientras se crea, edita o e…
│   │   │   ├── ConfirmDialog.stories.tsx       # [Sprint 11.2] Storybook: ConfirmDialog (default · estados de carga, vacío y error) con axe
│   │   │   ├── ConfirmDialog.tsx               # [EDITAR] cfd: confirmación destructiva + focus trap · ⚠ archivo vacío (marcador)
│   │   │   ├── DetailHeader.stories.tsx        # piezas de la página de detalle de Gestión
│   │   │   ├── DetailHeader.tsx                # piezas de la página de DETALLE de Gestión — el diseño del tema de Recursos (/admin/curriculum/tema)
│   │   │   ├── EmptyState.stories.tsx          # [Sprint 11.2] Storybook: EmptyState (default · estados de carga, vacío y error) con axe
│   │   │   ├── EmptyState.tsx                  # ems: Null Object pattern + CTA
│   │   │   ├── ErrorBoundary.stories.tsx       # [Sprint 11.2] Storybook: ErrorBoundary (default · estados de carga, vacío y error) con axe
│   │   │   ├── ErrorBoundary.tsx               # erb: captura errores React + fallback UI
│   │   │   ├── KindIcon.stories.tsx            # icono SVG de cada tipo de recurso
│   │   │   ├── KindIcon.tsx                    # icono SVG (lucide) de cada tipo de recurso → reemplaza los emojis de chips, tablas, portadas y tarjetas (antes mezcla de…
│   │   │   ├── LanguageChips.stories.tsx       # pestañas de idioma como enlaces (URL State)
│   │   │   ├── LanguageChips.tsx               # pestañas de idioma («✦ Todos» + «EN Inglés», «FR Francés»…) — la MISMA clasificación del catálogo de Cursos, ahora reuti…
│   │   │   ├── LanguageFlag.stories.tsx        # Bandera SVG por idioma
│   │   │   ├── LanguageFlag.tsx                # bandera SVG por idioma de curso (EN, FR, DE, ES, PT, ZH, RU) — SVG y no emoji: Windows no dibuja las banderas emoji (sal…
│   │   │   ├── LoadingSpinner.stories.tsx      # [Sprint 11.2] Storybook: LoadingSpinner (default · estados de carga, vacío y error) con axe
│   │   │   ├── LoadingSpinner.tsx              # lsp: aria-busy + aria-label "Cargando" · ⚠ archivo vacío (marcador)
│   │   │   ├── Markdown.stories.tsx            # render mínimo y seguro (sin dangerouslySetInnerHTML)
│   │   │   ├── Markdown.tsx                    # render MÍNIMO y seguro del Markdown que generan la IA y la importación (títulos, viñetas, listas numeradas, párrafos y *…
│   │   │   ├── Pagination.stories.tsx          # [Sprint 11.2] Storybook: Pagination (default · estados de carga, vacío y error) con axe
│   │   │   ├── Pagination.tsx                  # pgn: aria-label + URL state · ⚠ archivo vacío (marcador)
│   │   │   ├── PhoneLink.stories.tsx           # teléfono como enlace tel: o «—» si falta
│   │   │   ├── PhoneLink.tsx                   # muestra el teléfono del usuario como enlace `tel:` (un toque llama desde el móvil) o «—» si no hay
│   │   │   ├── RememberReturn.tsx              # un listado (pestaña + filtros + página) se anota como «lugar de regreso» → el «Volver a …» de sus formularios
│   │   │   ├── ResultDialog.stories.tsx        # [Sprint 11.2] Storybook: ResultDialog (default · estados de carga, vacío y error) con axe
│   │   │   ├── ResultDialog.tsx                # ResultDialog (Client/Presentational)
│   │   │   ├── SocialLinks.stories.tsx         # iconos-enlace a las redes del docente
│   │   │   ├── SocialLinks.tsx                 # iconos-enlace a las redes del docente (LinkedIn, X, Spotify, YouTube) — oculta las no configuradas
│   │   │   ├── TextImport.stories.tsx          # importar contenido desde archivo o enlace
│   │   │   ├── TextImport.tsx                  # «Importar contenido» desde un ARCHIVO (PDF, Word, Excel, texto, imagen con OCR, audio/video con transcripción) o un ENLA…
│   │   │   ├── Toaster.stories.tsx     # [Sprint 11.2] Storybook: Toaster (default · estados de carga, vacío y error) con axe
│   │   │   ├── Toaster.tsx             # avisos «guardado / editado / eliminado» (evento aula:toast compartido con Angular) · 2026-10-19
│   │   │   ├── SearchBar.stories.tsx           # [Sprint 11.2] Storybook: SearchBar (default · estados de carga, vacío y error) con axe
│   │   │   ├── SearchBar.tsx                   # [LISTAR] srb: debounce 300ms + aria-label · ⚠ archivo vacío (marcador)
│   │   │   ├── SEOHead.tsx                     # seo: OG tags + JSON-LD structured data
│   │   │   ├── WordDictionary.stories.tsx      # Diccionario al pulsar una palabra (escucha clics en el documento)
│   │   │   └── WordDictionary.tsx              # el pequeño diccionario de docs/imagen.jpeg en TODO el portal → pulsar o seleccionar UNA palabra en otro idioma abre 🔊 + …
│   │   └── ui/                                 # Atoms — shadcn/ui primitivas accesibles
│   │       ├── avatar.stories.tsx              # [Sprint 11.2] Storybook: avatar (variantes, tamaños y estados) con axe
│   │       ├── avatar.tsx                      # avt: img con alt + fallback iniciales · ⚠ archivo vacío (marcador)
│   │       ├── badge.stories.tsx               # [Sprint 11.2] Storybook: badge (variantes, tamaños y estados) con axe
│   │       ├── badge.tsx                       # bdg: colores semánticos + role="status" · ⚠ archivo vacío (marcador)
│   │       ├── button.tsx                      # btn: variantes CVA + aria-disabled + focus-visible
│   │       ├── button.stories.tsx              # [Sprint 11.2] Storybook: variantes y tamaños de Button
│   │       ├── card.stories.tsx                # [Sprint 11.2] Storybook: card (variantes, tamaños y estados) con axe
│   │       ├── card.tsx                        # crd: composable Card.Root/Header/Content/Footer · ⚠ archivo vacío (marcador)
│   │       ├── dialog.stories.tsx              # [Sprint 11.2] Storybook: dialog (variantes, tamaños y estados) con axe
│   │       ├── dialog.tsx                      # dlg: focus trap + Escape + aria-modal (Portal)
│   │       ├── input.tsx                       # inp: label asociado + error message + aria-invalid
│   │       ├── input.stories.tsx               # [Sprint 11.2] Storybook: Input (default/invalid/disabled) + PasswordInput
│   │       ├── label.stories.tsx               # [Sprint 11.2] Storybook: label (variantes, tamaños y estados) con axe
│   │       ├── label.tsx                       # lbl: htmlFor obligatorio (a11y)
│   │       ├── password-input.stories.tsx      # [Sprint 11.2] Storybook: password-input (variantes, tamaños y estados) con axe
│   │       ├── password-input.tsx              # PasswordInput: input con toggle ver/ocultar contraseña
│   │       ├── progress.stories.tsx            # [Sprint 11.2] Storybook: progress (variantes, tamaños y estados) con axe
│   │       ├── progress.tsx                    # prg: aria-valuenow + aria-valuemax · ⚠ archivo vacío (marcador)
│   │       ├── select.stories.tsx              # [Sprint 11.2] Storybook: select (variantes, tamaños y estados) con axe
│   │       ├── select.tsx                      # sel: Radix Select + aria-expanded · ⚠ archivo vacío (marcador)
│   │       ├── separator.stories.tsx           # [Sprint 11.2] Storybook: separator (variantes, tamaños y estados) con axe
│   │       ├── separator.tsx                   # sep: role="separator" + aria-orientation · ⚠ archivo vacío (marcador)
│   │       ├── skeleton.stories.tsx            # [Sprint 11.2] Storybook: skeleton (variantes, tamaños y estados) con axe
│   │       ├── skeleton.tsx                    # skl: aria-busy placeholder de carga · ⚠ archivo vacío (marcador)
│   │       ├── tabs.stories.tsx                # [Sprint 11.2] Storybook: tabs (variantes, tamaños y estados) con axe
│   │       ├── tabs.tsx                        # tab: aria-tablist + aria-selected · ⚠ archivo vacío (marcador)
│   │       ├── toast.stories.tsx               # [Sprint 11.2] Storybook: toast (variantes, tamaños y estados) con axe
│   │       ├── toast.tsx                       # tst: aria-live="assertive" notificaciones · ⚠ archivo vacío (marcador)
│   │       ├── tooltip.stories.tsx             # [Sprint 11.2] Storybook: tooltip (variantes, tamaños y estados) con axe
│   │       └── tooltip.tsx                     # ttp: aria-describedby + no solo color · ⚠ archivo vacío (marcador)
│   ├── config/                                 # Configuración
│   │   ├── angular.ts                       # Remoto Angular: ANGULAR_PREFIXES (rewrites + rutas protegidas), base /ng y ANGULAR_URL
│   │   ├── brand.ts                            # Marca (constantes TypeScript)
│   │   ├── curriculum-topics.ts                # Temas del currículo (constantes TypeScript) · menú, temas e i18n viven en packages/* (Sprint 7.1)
│   │   ├── ipa-chart.ts                        # alfabeto fonético del INGLÉS (44 fonemas, referencia británica RP con notas de EE. UU.) agrupado por temas, con palabra …
│   │   ├── ipa-phoneme-details.ts              # contenido AMPLIADO de cada fonema del inglés para la página de detalle /resources/fonema (Recursos › Pronunciación › tar…
│   │   └── ipa-sentence-ipa.ts                 # IPA de «Frases donde se oye» (config/ipa-phoneme-details.ts)
│   ├── docs/
│   │   ├── Introduccion.mdx
│   │   ├── SistemaDeDiseno.mdx
│   │   └── story-fixtures.ts                   # datos de ejemplo COMPARTIDOS por las historias de src/components (cursos, exámenes, currículo, landing)
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
│   │   ├── useTimer.ts                         # Countdown + onTimeout + pause/resume
│   │   └── useVocabulary.ts                    # diccionario al pulsar una palabra (IPA + traducción según la frase) y «Aprender / Aprendido» en React
│   ├── lib/                                    # Utilidades — capa Infraestructura FE
│   │   ├── bff/                                # Utilidades del BFF
│   │   │   └── forward.ts                      # reenvío único hacia NestJS: cookie httpOnly → Bearer, cuerpo, multipart, Range/206 y SSE
│   │   ├── activities-api.ts                   # secciones de Actividades (práctica, juegos, música, diálogos, poliglota y gramática) — una SSOT para la página del estud…
│   │   ├── activity-kinds.ts                   # «Crear actividad» de Gestión → Actividades — UNA tabla de estrategias por tipo (práctica, diálogo, gramática, poliglota)
│   │   ├── ai-api.ts                           # llamadas server-side a NestJS /ai/* (que a su vez usa FastAPI)
│   │   ├── api-client.ts                       # fetch nativo: baseURL + Bearer JWT
│   │   ├── auth-config.ts                      # Configuración Auth.js v5: providers OAuth + callbacks mínimos para flujo bridge
│   │   ├── auth-nextauth.ts                    # auth-nextauth
│   │   ├── auth.ts                             # NextAuth config: providers, callbacks, session
│   │   ├── bff.ts                              # Helper BFF: plantilla común de Route Handlers mutadores (parseo JSON, refresco de token, traducción de errores)
│   │   ├── categories.ts                       # SSOT competencias lingüísticas: valor (enum backend) + etiqueta ES + emoji en un solo lugar
│   │   ├── constants.ts                        # Constantes globales (DRY)
│   │   ├── course-access.ts                    # ¿el usuario puede GESTIONAR (editar, publicar, borrar, adjuntar material) este curso?
│   │   ├── course-progress.ts                  # progreso REAL de un curso calculado igual en todas las barras (página de la lección, temario, recursos)
│   │   ├── courses-api.ts                      # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] courses-api
│   │   ├── curriculum-api.ts                   # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] curriculum-api
│   │   ├── errors.ts                           # Error classes tipadas + mensajes de usuario
│   │   ├── extract-text-pdf.ts                 # pdf.js (build legacy de Node) + Tesseract.js + zlib → nunca se empaqueta para el navegador (lo importa lib/extract-text,…
│   │   ├── extract-text.ts                     # usa safeFetch (node:*) y librerías de Node → nunca se empaqueta para el navegador
│   │   ├── help-api.ts                         # [LISTAR, VER DETALLE] faqs públicas (solo lectura)
│   │   ├── i18n-server.ts                      # i18n-server
│   │   ├── jobs-api.ts                         # [LISTAR, VER DETALLE, EDITAR] listJobs() y getJob(id) hacia NestJS /admin/jobs (solo servidor); el BFF usa la ruta comodín app/api/[...path]
│   │   ├── lang-detect.ts                      # detección LIGERA del idioma de un trozo de texto (sin red ni modelos) → la lectura en voz alta solo pronuncia el idioma …
│   │   ├── languages.ts                        # SSOT idiomas objetivo: código ISO 639-1 + etiqueta ES, alineado con Language VO del backend
│   │   ├── map-limit.ts                        # `Promise.all` con como máximo `limit` promesas a la vez y resultados en el MISMO orden
│   │   ├── materials-client.ts                 # materials-client
│   │   ├── oauth-bridge.ts                     # oauth-bridge
│   │   ├── pdf-text-core.ts                    # parte PURA del lector de PDF (sin DOM, sin Worker, sin pdf.js) → la comparten el navegador (lib/pdf-text) y el servidor …
│   │   ├── pdf-text.ts                         # pdfText: extrae el texto de un PDF con pdf.js en un Web Worker (líneas separadas por \n, páginas por \n\n)
│   │   ├── period.ts                           # Filtro de periodo compartido por dashboards y reportes (parsePeriod)
│   │   ├── profile-api.ts                      # [LISTAR, VER DETALLE, EDITAR] profile-api
│   │   ├── purchase-actions.ts                 # [CREAR] RPC tipado al backend
│   │   ├── quiz-api.ts                         # [CREAR, LISTAR, VER DETALLE, EDITAR, ELIMINAR] Fachada HTTP de Quiz · ⚠ FRAGMENTACIÓN: también expone usuarios (listUsers, getUser, listStudents) y puntajes (getUserStats, getLeaderboard); separar en users-api.ts y score-api.ts
│   │   ├── reading.ts                          # tipos y funciones PURAS de la sección Lectura en Next.js — géneros con etiqueta, longitudes, texto importado → párrafos …
│   │   ├── resource-import.ts                  # Importación de recursos: convierte filas de texto (de Excel, Word, PDF, OCR o .txt) en contenidos por tipo de recurso, listos para revisar en el formulario
│   │   ├── safe-fetch.ts                       # Solo servidor: usa módulos node:* (dns, http, net) → no puede empaquetarse para el navegador
│   │   ├── safe-return.ts                      # destino de `?from=` tras iniciar sesión → solo rutas internas
│   │   ├── seo.ts                              # Helpers generateMetadata + JSON-LD schemas
│   │   ├── slug.ts                             # Slug determinista: espejo exacto de apps/backend/src/modules/curriculum/domain/slug.ts (vista previa en UI; el backend es la autoridad)
│   │   ├── speech.ts                           # Speech: pronunciación con la voz del navegador (Web Speech API, sin servidor ni red)
│   │   ├── stream-proxy.ts                     # [VER DETALLE] streaming BFF ↔ NestJS (Range/206, SSE) · redirect manual: la 302 a la URL firmada de S3/R2 llega al navegador (Sprint 6.7)
│   │   ├── strip-markup.ts                     # quita etiquetas que dejó la IA en preguntas ya guardadas («<text>¿…?</text>») — SOLO al mostrar (el valor enviado sigue …
│   │   ├── syllabus.ts                         # el TEMARIO de un curso = lista de subtemas («## Título» + explicación en Markdown) guardada en `course.content`
│   │   ├── text-highlight.ts                   # localiza en el DOM ya pintado (Markdown) la frase que suena y su palabra
│   │   ├── token-refresh.ts                    # UNA sola renovación por refresh token, aunque lleguen varias peticiones a la vez
│   │   ├── utils.ts                            # cn() + formatters + helpers generales
│   │   ├── validations.ts                      # Zod schemas: login, register, quiz, profile
│   │   └── youtube.ts                          # enlace de YouTube (watch, youtu.be, shorts, embed) → URL de inserción privada (youtube-nocookie) | null si no es YouTube
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
│   ├── stories/                                # [Sprint 11.2] Páginas MDX del catálogo (no son componentes)
│   │   ├── Introduction.mdx                    # Bienvenida al catálogo: Atomic Design, cómo escribir una historia y reglas de a11y
│   │   └── Themes.mdx                          # Los temas y el modo oscuro de packages/ui-tokens con su contraste AA
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
│   │   │   ├── activities/
│   │   │   │   └── ActivityPreview.polyglot.test.tsx  # la vista previa pinta el tema de la actividad en una tabla propia, sin el <iframe> de la pantalla completa
│   │   │   ├── admin/
│   │   │   │   ├── ActivitiesNoModal.test.tsx  # confirmación de borrado EN la fila (RowActions confirm="inline") y editor de filas del borrador (DraftEditor)
│   │   │   │   ├── LanguageChecks.test.tsx     # multiselect desplegable de idiomas de Poliglota (estilo Mendix) — abrir, marcar, quitar con ×,
│   │   │   │   ├── NewUserPage.test.tsx        # [CREAR] CREAR: monta UserForm mode="create"
│   │   │   │   └── UserForm.test.tsx           # UserForm en modos create, edit y view
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.test.tsx          # Validación Zod: email inválido muestra error
│   │   │   │   ├── OAuthButtons.test.tsx       # Botones OAuth con aria-label y redirección
│   │   │   │   ├── RegisterForm.test.tsx       # [CREAR] Multi-step: avanza solo si paso actual es válido
│   │   │   │   └── SessionWatcher.test.tsx     # un 401 de /api comprueba la sesión al momento, sin alterar la respuesta
│   │   │   ├── courses/
│   │   │   │   ├── CourseReactionBar.test.tsx  # ⭐ 👍 ❤️ — estados, accesibilidad (aria-pressed + nombre con conteo), excluyentes, reversión ante error y login sin sesión
│   │   │   │   ├── CourseSyllabus.test.tsx     # temario = subtemas · bloqueado sin iniciar el curso · «Marcar como completado» llama a la Server Action
│   │   │   │   ├── pdf-furniture.test.ts       # pies y encabezados de página fuera del lector en voz alta; el texto del cuerpo se queda
│   │   │   │   └── PdfReader.text.test.ts      # lector del temario — Markdown → frases limpias por párrafo; y la mezcla de idiomas que bloquea «Traducir»
│   │   │   ├── curriculum/
│   │   │   │   └── MouthMedia.test.tsx         # «Cómo se pronuncia» con imagen o video de la boca — vista (img/video según la clave), subida al BFF,
│   │   │   ├── language/
│   │   │   │   ├── ResourceVocabularyField.test.tsx  # «Usar» traducción e IPA UK/US, IA caída y respaldo de <IpaTextHost>
│   │   │   │   ├── TopicTitle.test.tsx         # una sola petición por tema+idioma aunque React StrictMode monte dos veces, caché negativa corta tras un fallo
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
│   │   │   │   ├── ErrorBoundary.test.tsx      # Captura error hijo y muestra fallback UI
│   │   │   │   └── WordCard.test.tsx           # IPA antes que la traducción · el switch UK/US cambia la IPA
│   │   │   ├── ui/
│   │   │   │   ├── button.test.tsx             # Variantes CVA, estados disabled, aria-disabled
│   │   │   │   ├── dialog.test.tsx             # Focus trap activo, Escape cierra, aria-modal
│   │   │   │   └── input.test.tsx              # aria-invalid cuando hay error, label asociado
│   │   │   ├── Markdown.examples.test.tsx      # siempre «frase (traducción)» uno por línea, sin repetidos, con la frase en el color del idioma del curso
│   │   │   └── portal-frame.ssr.test.tsx       # «Element type is invalid … got: undefined» en /dashboard/admin solo aparece al renderizar en el servidor → aquí se rende…
│   │   ├── config/
│   │   │   ├── ipa-phoneme-details.test.ts     # el detalle de Recursos › Pronunciación cubre los 44 fonemas del inglés con 8–12 palabras, frases y errores, y la URL es …
│   │   │   ├── topic-level.test.ts             # Prueba
│   │   │   └── verify-route.test.ts            # ruta ÚNICA de verificación pública (/certificados/verificar) y redirección permanente de /verificar
│   │   ├── hooks/
│   │   │   ├── useAuth.test.ts                 # Devuelve user/roles, redirige si no auth
│   │   │   ├── useDebounce.test.ts             # Retrasa actualización N ms correctamente
│   │   │   ├── useLocalStorage.test.ts         # Persiste y parsea tipo genérico con Zod
│   │   │   └── useTimer.test.ts                # Decrementa cada 1s, llama onTimeout() en 0
│   │   ├── lib/
│   │   │   ├── activity-kinds.test.ts          # estrategias de «Crear actividad» — mapeo de lo importado, ida y vuelta de ítems, validación y guardado con un ApiPort fa…
│   │   │   ├── categories.test.ts              # SSOT de competencias: valor, etiqueta y emoji
│   │   │   ├── course-content-helpers.test.ts  # lector de PDF legible · entradas partidas por el PDF · etiquetas automáticas del curso
│   │   │   ├── course-progress.test.ts         # % real del curso (espejo de NestJS recompute) y trozos por idioma de la lectura en voz alta
│   │   │   ├── draft-in-batches.test.ts        # la cantidad pedida a la IA por tandas (Práctica daba 504 con 10 de golpe; el mazo devolvía 14 de 16)
│   │   │   ├── extract-text-pdf.test.ts        # imagen decodificada por pdf.js → PNG en grises para el OCR de PDF escaneados
│   │   │   ├── forward.test.ts                 # Lista blanca del BFF comodín (incl. games, practice, vocabulary, speech, music y dialogues), SSE, 206 del audio y 413 si supera 10 MB (20 MB en música)
│   │   │   ├── languages.test.ts               # SSOT de idiomas
│   │   │   ├── map-limit.test.ts               # paralelismo acotado con orden estable (guardado de recursos y conceptos)
│   │   │   ├── materials.test.ts               # Cliente de materiales
│   │   │   ├── only-language.test.ts           # Prueba
│   │   │   ├── pdf-columns.test.ts             # página de soluciones a dos columnas → se lee la izquierda entera y luego la derecha; las tablas no se parten
│   │   │   ├── period.test.ts                  # parsePeriod
│   │   │   ├── reading-dictation.test.ts       # el front cuenta frases con la misma regla que NestJS y dice qué falta
│   │   │   ├── reading.test.ts                 # funciones puras de lib/reading (texto importado → párrafos, frases → párrafos) y la estrategia «Lectura» de Crear activi…
│   │   │   ├── resource-import.test.ts         # Filas importadas → contenidos por tipo
│   │   │   ├── safe-fetch.test.ts              # Bloquea IP privadas (SSRF)
│   │   │   ├── slug.test.ts                    # Slug determinista igual al del backend
│   │   │   ├── stream-proxy.test.ts            # [Sprint 6.7] 302 a la URL firmada sin seguir la redirección; reenvía Location y Range
│   │   │   ├── syllabus.test.ts                # ida y vuelta del temario (subtemas «## …») e importación como subtemas
│   │   │   ├── text-highlight.test.ts          # la frase del lector se encuentra en el texto pintado del temario aunque el Markdown cambie signos y negritas
│   │   │   ├── token-refresh.test.ts           # refresh de un solo uso → varias peticiones simultáneas comparten una rotación; un fallo no se recuerda
│   │   │   ├── utils.test.ts                   # cn() resuelve conflictos Tailwind correctamente
│   │   │   ├── validations.test.ts             # Schemas Zod: casos válidos e inválidos
│   │   │   └── youtube.test.ts                 # enlaces de YouTube → URL de inserción · el resto → null
│   │   ├── store/
│   │   │   ├── authSlice.test.ts               # setCredentials guarda user+token, logout limpia
│   │   │   ├── quizSlice.test.ts               # setAnswer guarda respuesta, nextQuestion avanza índice
│   │   │   └── timerSlice.test.ts              # tick decrementa, pause detiene, reset reinicia
│   │   ├── types/
│   │   │   └── vocabulary-article.test.ts      # espejo de la regla de NestJS (artículo obligatorio en sustantivos de/fr/pt/es, opcional en en, «No aplica» en ru/zh)
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
│   ├── images/                                 # Imágenes estáticas optimizadas (WebP)
│   ├── file.svg                                # Recurso estático (imagen)
│   ├── globe.svg                               # Recurso estático (imagen)
│   ├── next.svg                                # Recurso estático (imagen)
│   ├── vercel.svg                              # Recurso estático (imagen)
│   └── window.svg                              # Recurso estático (imagen)
├── .storybook/                                 # [Sprint 11.2] Storybook 10 (@storybook/nextjs-vite) · pnpm storybook (:6006) · pnpm build-storybook
│   ├── main.ts                                 # Historias src/**/*.stories.tsx + addons docs y a11y (axe)
│   ├── decorators.tsx                          # [Sprint 11.2] Decorators reutilizables: Provider de Redux, ThemeProvider y next/navigation simulado
│   ├── handlers.ts                             # [Sprint 11.2] Reutiliza los handlers de MSW de __tests__ para que las historias no llamen a la API real
│   ├── preview.tsx                             # globals.css + decorator de tema + a11y.test='error' + App Router simulado
│   └── manager.ts                              # [Sprint 11.2] Título, marca y panel de accesibilidad abierto por defecto
├── .env.example                                # Plantilla de variables de entorno
├── .env.local                                  # Variables locales (no commitear — .gitignore)
├── .gitignore                                  # Configuración
├── AGENTS.md                                   # Documentación
├── CLAUDE.md                                   # Documentación
├── components.json                             # shadcn/ui: config paths + style tokens
├── Dockerfile                                  # build multi-etapa (compila → imagen final con .next + dependencias de producción)
├── Dockerfile.dockerignore                     # ignore propio de este Dockerfile (el contexto es la raíz del monorepo)
├── eng.traineddata
├── eslint.config.mjs
├── informeProyecto.docx
├── jest.config.mjs                             # solo tests unit/integration (jsdom) — excluye Playwright (functional/performance/usability)
├── jest.config.ts                              # jsdom + coverage thresholds + moduleNameMapper · ℹ definido en next_estructura.md; no existe en el código
├── jest.setup.ts                               # jest-dom matchers + MSW server setup
├── lighthouserc.js                             # Lighthouse CI thresholds (Core Web Vitals)
├── Next estructurav2.md                        # Documentación
├── next-env.d.ts
├── next.config.ts                              # Turbopack + rewrites hacia el remoto Angular (/ng/*, /tutor, /redaccion, /estudio/*, /notificaciones, /reportes/*)
├── next_estructura copy.md                     # Documentación
├── next_estructura.md                          # Documentación
├── nextjs-setup.md                             # Documentación
├── package.json                                # Configuración
├── pendiente.md                                # Documentación
├── playwright.config.ts                        # Browsers + baseURL + retries + reporters
├── pnpm-lock.yaml                              # Configuración
├── pnpm-workspace.yaml                         # reemplaza ignoredBuiltDependencies
├── postcss.config.mjs
├── README.md                                   # Documentación
├── spa.traineddata
├── tailwind.config.ts                          # Tokens: colores, tipografía, breakpoints, dark mode
├── tsconfig.json                               # strict:true + paths alias @/ + decoratorMetadata
└── typedoc.json                                # [Sprint 11.2] TypeDoc: documenta src/ (TSDoc) y se publica en el sitio MkDocs único
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
    ├── cefr-colors.ts                          # color de cada banda MCER (A1–C2) — diploma de certificados, Tutor IA y Corrector de redacciones
    ├── motion.css                              # prefers-reduced-motion: anula animaciones no esenciales (RF-70) · lo importa globals.css
    ├── tailwind-preset.ts                      # Temas de Tailwind CSS 4: lista tipada de los 6 temas, metadatos y script anti-parpadeo (RF-70)
    └── typography.css
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
| Storybook 10 (@storybook/nextjs-vite) + addon a11y | Componentes + Usabilidad (a11y) | Una historia por componente de `src/components/` con axe (`a11y.test='error'`); `pnpm storybook` (:6006) y `pnpm build-storybook` |

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
| TypeDoc | Documentación de código TypeScript (TSDoc) de `src/`, publicada en el sitio MkDocs único del repositorio |
