# Next.js 15 — Estructura de Carpetas

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
- **Infrastructure**: RTK Query (fetch), NextAuth, axios (api-client.ts), localStorage
- **Presentation**: `app/` pages + `components/` (Atomic Design)

**Patrones GoF y Arquitectónicos:** Container/Presentational · Error Boundary · Observer (RTK Query/SSE) · Proxy (API routes BFF) · Null Object (EmptyState) · Memento (Redux DevTools) · State (quizSlice) · Decorator (Metadata API) · Adapter (NextAuth providers) · Composite (shadcn/ui)

**Patrones React (patterns.dev):**
- **HOC Pattern**: `withAuth()`, `withRoles()` — comportamiento transversal sin modificar componentes
- **Hooks Pattern**: `useTimer`, `useAuth`, `useQuiz`, `useSSE`, `useDebounce` — lógica reutilizable extraída
- **Compound Pattern**: `QuizCard.Root + QuizCard.Header + QuizCard.Body` — estado compartido sin prop drilling
- **Container/Presentational**: `QuizListContainer` (datos) → `QuizGrid` (visual); `AuthContainer` → `LoginForm`
- **Render Props Pattern**: `<Timer render={(time) => <TimerBar value={time} />} />` — reutilizar lógica con distintas UIs

**Patrones de Renderizado (Next.js 15):**
- **CSR** (Client-Side Rendering): quiz activo, chat IA, formularios interactivos
- **SSR** (Server-Side Rendering): dashboard, perfil, listado de quizzes, resultados
- **SSG** (Static Rendering): landing page, términos, páginas de error
- **ISR** (Incremental Static Generation): leaderboard (revalidate: 60s), categorías
- **Progressive Hydration**: componentes pesados (WeaknessChart, AssistantChat)
- **Streaming SSR**: layout con Suspense boundaries; partes se envían en stream
- **React Server Components (RSC)**: Navbar, Footer, PageHeader, LeaderboardTable
- **Selective Hydration**: `'use client'` solo donde hay interactividad real

**AI UI Patterns y React Stack 2026:**
- **Streaming Response**: AssistantChat muestra respuesta token a token vía SSE
- **Optimistic Updates**: mensaje del usuario aparece antes de respuesta IA
- **Server Actions**: mutaciones de formulario sin Route Handler explícita
- **Partial Prerendering**: shell estático instantáneo + partes dinámicas en stream
- **use() hook**: lectura de Promises en RSC sin useEffect
- **useTransition**: navegación entre preguntas sin bloquear la UI

**Paradigmas:** Declarativo (JSX) · Funcional (hooks/funciones puras) · Reactivo (RTK Query/SSE) · Async/Await · Orientado a Eventos (Redux)

**Prácticas:** SOLID · DRY · Clean Code · Type-Safe (TS strict + Zod) · SEO (Metadata API + sitemap.ts + JSON-LD) · A11y (WCAG 2.1 AA) · Responsive (Tailwind breakpoints) · SSR/SSG · Rutas públicas/protegidas (`middleware.ts` + NextAuth)

**Tecnologías:** Next.js 15 · React 18 · TypeScript 5 · Redux Toolkit 2 · Tailwind CSS 3 · shadcn/ui · Radix UI · Zod · React Hook Form · NextAuth.js · Playwright · Jest · MSW · ESLint · Prettier

**Nota — MCP (Model Context Protocol):** El frontend Next.js 15 puede consumir herramientas expuestas por el AI Service (FastAPI) a través del protocolo MCP. MCP es un protocolo JSON-RPC 2.0 sobre HTTP/SSE definido por Anthropic para la comunicación entre agentes IA y clientes. En este proyecto el componente `AssistantChat.tsx` consume las `tools[]` del agente tutor vía el endpoint MCP del AI Service, con autenticación JWT.

**Nota — JSON:API:** JSON:API NO es un protocolo de API ni de comunicación. Es una convención de formato de respuesta REST (especificación jsonapi.org). Las respuestas del backend NestJS siguen un envelope `{ data, meta, errors }` compatible con JSON:API 1.1, procesado por RTK Query en el frontend.

---

## Estructura de Carpetas Completa

```
apps/frontend-next/                                 # MVC + Clean Architecture + Atomic Design: View=app/ · Controller=api/+hooks · Model=store/ · Infra=lib/
├── src/
│   │
│   ├── app/                                   # App Router — capa Presentación
│   │   ├── (auth)/                          # Grupo rutas públicas — sin sesión (auth)
│   │   │   ├── layout.tsx                     # Layout auth: sin navbar/sidebar: navbar mínimo + SEO base
│   │   │   ├── page.tsx                       # Landing: SSG + generateMetadata SEO + JSON-LD
│   │   │   ├── login/
│   │   │   │   ├── page.tsx                   # Login: SSR + redirect si ya auth + generateMetadata
│   │   │   │   └── loading.tsx                # Skeleton SSR mientras carga
│   │   │   ├── register/
│   │   │   │   ├── page.tsx                   # Registro: multi-step + Zod + RHF
│   │   │   │   └── loading.tsx
│   │   │   └── terms/
│   │   │       └── page.tsx                   # Términos: SSG estático
│   │   │
│   │   ├── (portal)/                       # Grupo rutas protegidas — requieren sesión activa (portal)
│   │   │   ├── layout.tsx                     # Layout dashboard: sidebar + navbar + auth check: sidebar + navbar + auth check
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx                   # Dashboard: SSR + stats usuario + generateMetadata
│   │   │   │   └── loading.tsx                # Skeleton dashboard
│   │   │   ├── quiz/
│   │   │   │   ├── page.tsx                   # Listado: SSR + paginación + filtros en URL
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── create/
│   │   │   │   │   ├── page.tsx               # Crear quiz: Client Component + RHF + Zod
│   │   │   │   │   └── loading.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx               # Detalle: SSR + generateMetadata dinámico + OG image
│   │   │   │       ├── play/
│   │   │   │       │   └── page.tsx           # Jugar: Client Component + timer + Redux quizSlice
│   │   │   │       ├── results/
│   │   │   │       │   └── page.tsx           # Resultados: SSR + feedback IA + score
│   │   │   │       ├── loading.tsx
│   │   │   │       └── not-found.tsx          # 404 específico de quiz
│   │   │   ├── leaderboard/
│   │   │   │   ├── page.tsx                   # Ranking: SSR + revalidate 60s + generateMetadata
│   │   │   │   └── loading.tsx
│   │   │   ├── profile/
│   │   │   │   ├── page.tsx                   # Perfil propio: SSR
│   │   │   │   ├── edit/
│   │   │   │   │   └── page.tsx               # Editar perfil: Client Component + RHF
│   │   │   │   └── [username]/
│   │   │   │       └── page.tsx               # Perfil público: SSR + generateMetadata
│   │   │   └── assistant/
│   │   │       └── page.tsx                   # Chat tutor IA: Client Component + SSE stream
│   │   │
│   │   ├── api/                               # Route Handlers — BFF Pattern
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts               # NextAuth: JWT + OAuth providers
│   │   │
│   │   ├── layout.tsx                         # Root layout: fonts + providers + metadata base
│   │   ├── page.tsx                           # Redirect a /dashboard o /login
│   │   ├── error.tsx                          # Error Boundary global (patrón React)
│   │   ├── not-found.tsx                      # 404 global
│   │   ├── sitemap.ts                         # Sitemap dinámico generado en build (SEO)
│   │   ├── robots.ts                          # robots.txt generado (SEO)
│   │   └── globals.css                        # Tailwind directives + CSS custom properties
│   │
│   ├── components/                            # Atomic Design
│   │   │
│   │   ├── ui/                                # Atoms — shadcn/ui primitivas accesibles
│   │   │   ├── button.tsx                     # btn: variantes CVA + aria-disabled + focus-visible
│   │   │   ├── input.tsx                      # inp: label asociado + error message + aria-invalid
│   │   │   ├── card.tsx                       # crd: composable Card.Root/Header/Content/Footer
│   │   │   ├── dialog.tsx                     # dlg: focus trap + Escape + aria-modal (Portal)
│   │   │   ├── badge.tsx                      # bdg: colores semánticos + role="status"
│   │   │   ├── progress.tsx                   # prg: aria-valuenow + aria-valuemax
│   │   │   ├── skeleton.tsx                   # skl: aria-busy placeholder de carga
│   │   │   ├── toast.tsx                      # tst: aria-live="assertive" notificaciones
│   │   │   ├── tooltip.tsx                    # ttp: aria-describedby + no solo color
│   │   │   ├── select.tsx                     # sel: Radix Select + aria-expanded
│   │   │   ├── tabs.tsx                       # tab: aria-tablist + aria-selected
│   │   │   ├── avatar.tsx                     # avt: img con alt + fallback iniciales
│   │   │   ├── separator.tsx                  # sep: role="separator" + aria-orientation
│   │   │   └── label.tsx                      # lbl: htmlFor obligatorio (a11y)
│   │   │
│   │   ├── quiz/                              # Molecules — dominio Quiz
│   │   │   ├── QuizCard.tsx                   # qzc: tarjeta resumen con link semántico
│   │   │   ├── QuizGrid.tsx                   # qzg: grid responsivo sm:1 md:2 lg:3 cols
│   │   │   ├── QuestionCard.tsx               # qnc: pregunta + opciones + keyboard nav (a11y)
│   │   │   ├── AnswerOption.tsx               # ano: radio accesible con estado visual
│   │   │   ├── TimerBar.tsx                   # tmb: aria-live="polite" + aria-valuenow
│   │   │   ├── ScoreDisplay.tsx               # scd: puntuación animada (respeta reduced-motion)
│   │   │   ├── DifficultyBadge.tsx            # dfb: nivel dificultad con color + texto (no solo color)
│   │   │   ├── CategoryIcon.tsx               # cti: icono Lucide + aria-label descriptivo
│   │   │   ├── QuizFilter.tsx                 # qzf: filtros en URL (URL State Pattern)
│   │   │   └── QuizProgress.tsx               # qzp: N/total preguntas con aria-label
│   │   │
│   │   ├── ai/                                # Molecules — dominio IA
│   │   │   ├── FeedbackPanel.tsx              # fbp: panel feedback post-quiz con secciones
│   │   │   ├── RecommendationCard.tsx         # rcc: sugerencia de estudio con prioridad
│   │   │   ├── WeaknessChart.tsx              # wkc: gráfico recharts áreas de mejora
│   │   │   └── AssistantChat.tsx              # asc: chat tutor IA con SSE stream
│   │   │
│   │   ├── leaderboard/                       # Molecules — dominio Ranking
│   │   │   ├── LeaderboardTable.tsx           # lbt: tabla ranking paginada + aria-sort
│   │   │   ├── RankBadge.tsx                  # rnb: medallas #1 #2 #3 con aria-label
│   │   │   └── UserRankRow.tsx                # urr: fila de usuario con avatar + score
│   │   │
│   │   ├── auth/                              # Molecules — dominio Auth
│   │   │   ├── LoginForm.tsx                  # lgf: form + Zod + RHF + error messages a11y
│   │   │   ├── RegisterForm.tsx               # rgf: multi-step + validación por paso
│   │   │   ├── OAuthButtons.tsx               # oab: Google + GitHub con aria-label
│   │   │   └── ProtectedRoute.tsx             # prt: HOC redirect si no auth (Guard pattern)
│   │   │
│   │   ├── layout/                            # Organisms — estructura global
│   │   │   ├── Navbar.tsx                     # nvb: nav + skip-to-content + user menu + dark mode
│   │   │   ├── Sidebar.tsx                    # sdb: nav lateral + collapse mobile + aria-expanded
│   │   │   ├── Footer.tsx                     # ftr: links semánticos + copyright
│   │   │   ├── ThemeProvider.tsx              # thp: next-themes dark/light sin flash
│   │   │   └── PageHeader.tsx                 # pgh: breadcrumb (aria) + título + acciones
│   │   │
│   │   └── shared/                            # Shared UI — cross-domain
│   │       ├── ErrorBoundary.tsx              # erb: captura errores React + fallback UI
│   │       ├── EmptyState.tsx                 # ems: Null Object pattern + CTA
│   │       ├── LoadingSpinner.tsx             # lsp: aria-busy + aria-label "Cargando"
│   │       ├── Pagination.tsx                 # pgn: aria-label + URL state
│   │       ├── ConfirmDialog.tsx              # cfd: confirmación destructiva + focus trap
│   │       ├── SearchBar.tsx                  # srb: debounce 300ms + aria-label
│   │       └── SEOHead.tsx                    # seo: OG tags + JSON-LD structured data
│   │
│   ├── store/                                 # Redux Toolkit — capa Estado
│   │   ├── index.ts                           # Store: middleware + devtools + SSR hydration
│   │   ├── provider.tsx                       # StoreProvider para App Router
│   │   ├── slices/
│   │   │   ├── authSlice.ts                   # ath: user, token, roles, isAuthenticated
│   │   │   ├── quizSlice.ts                   # qzs: sesión activa, pregunta actual, respuestas
│   │   │   ├── uiSlice.ts                     # uis: sidebar open/close, theme, modal stack
│   │   │   └── timerSlice.ts                  # tms: countdown, estado (running/paused/ended)
│   │   └── api/                               # RTK Query — data fetching + caché
│   │       ├── baseApi.ts                     # Base: baseURL + prepareHeaders JWT + retry
│   │       ├── authApi.ts                     # Endpoints: login, register, refresh, logout
│   │       ├── quizApi.ts                     # Endpoints: CRUD quiz, preguntas OpenTrivia
│   │       ├── scoreApi.ts                    # Endpoints: submit, historial, leaderboard
│   │       └── aiApi.ts                       # Endpoints: grading, feedback, chat
│   │
│   ├── hooks/                                 # Custom Hooks — lógica reutilizable
│   │   ├── useAuth.ts                         # Sesión, roles, isLoading, redirect logic
│   │   ├── useQuiz.ts                         # Flujo: responder, avanzar, fin de sesión
│   │   ├── useTimer.ts                        # Countdown + onTimeout + pause/resume
│   │   ├── useSSE.ts                          # Server-Sent Events (feedback IA en tiempo real)
│   │   ├── useDebounce.ts                     # Debounce genérico type-safe <T>
│   │   ├── useMediaQuery.ts                   # Responsive breakpoints TS-safe (sm/md/lg/xl)
│   │   ├── useLocalStorage.ts                 # Persistencia local type-safe con Zod parse
│   │   └── useKeyboard.ts                     # Atajos de teclado accesibles (a11y)
│   │
│   ├── lib/                                   # Utilidades — capa Infraestructura FE
│   │   ├── utils.ts                           # cn() + formatters + helpers generales
│   │   ├── auth.ts                            # NextAuth config: providers, callbacks, session
│   │   ├── api-client.ts                      # Axios instance: baseURL + interceptors JWT
│   │   ├── validations.ts                     # Zod schemas: login, register, quiz, profile
│   │   ├── seo.ts                             # Helpers generateMetadata + JSON-LD schemas
│   │   ├── constants.ts                       # Constantes globales (DRY)
│   │   └── errors.ts                          # Error classes tipadas + mensajes de usuario
│   │
│   ├── middleware.ts                          # Middleware: rutas protegidas + JWT check + redirect
│   │
│   └── types/                                 # TypeScript — tipado estricto
│       ├── next-auth.d.ts                     # Extend Session/JWT con roles y userId
│       ├── env.d.ts                           # Type-safe process.env (t3-env + Zod)
│       └── global.d.ts                        # Tipos globales de la aplicación
│
│
├── __tests__/                                 # ══ PRUEBAS ══════════════════════════════
│   │
│   ├── unit/                                  # UNITARIAS — Jest + Testing Library
│   │   │                                      # Aislamiento total: mocks de deps externas
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── button.test.tsx            # Variantes CVA, estados disabled, aria-disabled
│   │   │   │   ├── input.test.tsx             # aria-invalid cuando hay error, label asociado
│   │   │   │   └── dialog.test.tsx            # Focus trap activo, Escape cierra, aria-modal
│   │   │   ├── quiz/
│   │   │   │   ├── QuestionCard.test.tsx      # Renderiza 4 opciones, resalta respuesta seleccionada
│   │   │   │   ├── TimerBar.test.tsx          # aria-live anuncia cambios, color rojo < 10s
│   │   │   │   ├── AnswerOption.test.tsx      # Estado correcto/incorrecto con feedback visual
│   │   │   │   └── ScoreDisplay.test.tsx      # Score renderiza correctamente con distintos valores
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.test.tsx         # Validación Zod: email inválido muestra error
│   │   │   │   └── RegisterForm.test.tsx      # Multi-step: avanza solo si paso actual es válido
│   │   │   └── shared/
│   │   │       ├── ErrorBoundary.test.tsx     # Captura error hijo y muestra fallback UI
│   │   │       └── EmptyState.test.tsx        # Renderiza CTA cuando lista está vacía
│   │   ├── hooks/
│   │   │   ├── useTimer.test.ts               # Decrementa cada 1s, llama onTimeout() en 0
│   │   │   ├── useDebounce.test.ts            # Retrasa actualización N ms correctamente
│   │   │   ├── useAuth.test.ts                # Devuelve user/roles, redirige si no auth
│   │   │   └── useLocalStorage.test.ts        # Persiste y parsea tipo genérico con Zod
│   │   ├── store/
│   │   │   ├── quizSlice.test.ts              # setAnswer guarda respuesta, nextQuestion avanza índice
│   │   │   ├── authSlice.test.ts              # setCredentials guarda user+token, logout limpia
│   │   │   └── timerSlice.test.ts             # tick decrementa, pause detiene, reset reinicia
│   │   ├── lib/
│   │   │   ├── utils.test.ts                  # cn() resuelve conflictos Tailwind correctamente
│   │   │   └── validations.test.ts            # Schemas Zod: casos válidos e inválidos
│   │   └── a11y/
│   │       ├── atoms.a11y.test.tsx            # jest-axe: 0 violaciones en todos los atoms
│   │       └── molecules.a11y.test.tsx        # jest-axe: QuizCard, QuestionCard, LoginForm
│   │
│   ├── integration/                           # INTEGRACIÓN — Jest + MSW 2.x
│   │   │                                      # Componentes + store + API mockeada
│   │   ├── QuizPage.test.tsx                  # Fetch preguntas MSW → render QuizGrid → click quiz
│   │   ├── QuizPlay.test.tsx                  # Responder preguntas → score → pantalla resultados
│   │   ├── AuthFlow.test.tsx                  # Login → token en Redux → request con Authorization
│   │   ├── AssistantChat.test.tsx             # MSW SSE mock → mensajes aparecen en tiempo real
│   │   ├── Leaderboard.test.tsx               # Fetch ranking MSW → tabla ordenada correctamente
│   │   └── FeedbackPanel.test.tsx             # RTK Query aiApi → FeedbackPanel renderiza datos IA
│   │
│   ├── functional/                            # FUNCIONALES (E2E) — Playwright
│   │   │                                      # Flujos completos con navegador real
│   │   ├── auth.spec.ts                       # Registro → verificación → login → dashboard
│   │   ├── quiz-flow.spec.ts                  # Seleccionar quiz → responder todas → ver score
│   │   ├── ai-feedback.spec.ts                # Quiz con errores → FeedbackPanel con IA visible
│   │   ├── leaderboard.spec.ts                # Jugar quiz → score aparece en ranking
│   │   ├── navigation.spec.ts                 # Todas las rutas cargan sin errores JS
│   │   ├── protected-routes.spec.ts           # Rutas /(portal) redirigen a /login sin token
│   │   ├── session-expiry.spec.ts             # Token expirado → redirect login → retorno a ruta
│   │   └── dark-mode.spec.ts                  # Toggle dark/light sin flash + contraste correcto
│   │
│   ├── performance/                           # RENDIMIENTO — Lighthouse CI + Playwright
│   │   │                                      # Core Web Vitals y optimización de bundle
│   │   ├── lighthouse.config.js               # Config: LCP<2.5s, FID<100ms, CLS<0.1
│   │   ├── landing.perf.spec.ts               # Playwright: TTI <3.5s en 3G throttled (mobile)
│   │   ├── quiz-page.perf.spec.ts             # LCP <2.5s SSR con 10 preguntas cargadas
│   │   ├── navigation.perf.spec.ts            # SPA routing entre rutas <200ms p95
│   │   └── bundle.analysis.ts                 # @next/bundle-analyzer: JS principal <200KB gz
│   │
│   └── usability/                             # USABILIDAD — Playwright + axe + SUS
│       │                                      # WCAG 2.1 AA, responsive, UX métricas
│       ├── accessibility.spec.ts              # axe-playwright: 0 violaciones críticas en 6 rutas
│       ├── keyboard-nav.spec.ts               # Tab/Enter/Escape: flujo completo sin ratón
│       ├── responsive.spec.ts                 # Viewports: 320/768/1024/1440/2560px sin overflow
│       ├── cross-browser.spec.ts              # Chromium + Firefox + WebKit: funcionalidad core
│       ├── dark-mode-contrast.spec.ts         # Contraste WCAG ≥4.5:1 en todos los componentes dark
│       ├── i18n.spec.ts                       # ES/EN: textos completos sin truncación
│       └── error-handling-ux.spec.ts          # Errores 404/500: EmptyState visible + botón retry
│
├── public/
│   ├── icons/                                 # Favicons PWA + manifest.json
│   ├── images/                                # Imágenes estáticas optimizadas (WebP)
│   └── fonts/                                 # Fuentes self-hosted (perf — evita FOUT)
│
├── components.json                            # shadcn/ui: config paths + style tokens
├── tailwind.config.ts                         # Tokens: colores, tipografía, breakpoints, dark mode
├── next.config.ts                             # Images, redirects, headers CSP, bundle analyzer
├── tsconfig.json                              # strict:true + paths alias @/ + decoratorMetadata
├── jest.config.ts                             # jsdom + coverage thresholds + moduleNameMapper
├── jest.setup.ts                              # jest-dom matchers + MSW server setup
├── playwright.config.ts                       # Browsers + baseURL + retries + reporters
├── lighthouserc.js                            # Lighthouse CI thresholds (Core Web Vitals)
├── .env.local                                 # Variables locales (no commitear — .gitignore)
├── .env.example                               # Plantilla de variables de entorno
└── package.json
```

## Patrones React Aplicados en la Estructura

### Patrones de Componentes (patterns.dev/react)

| Patrón | Dónde en la estructura | Implementación |
|--------|----------------------|----------------|
| **HOC Pattern** | `components/auth/ProtectedRoute.tsx` | `withAuth(Component)` redirige si no hay sesión; `withRoles(Component)` oculta por rol |
| **Hooks Pattern** | `hooks/` — todos los archivos | `useTimer`, `useAuth`, `useQuiz`, `useSSE`, `useDebounce` extraen lógica reutilizable |
| **Compound Pattern** | `components/quiz/QuizCard.tsx` | `QuizCard.Root + QuizCard.Header + QuizCard.Body` comparten estado sin prop drilling |
| **Container/Presentational** | `app/(portal)/quiz/page.tsx` + `components/quiz/QuizGrid.tsx` | Page = Container (fetch + estado); QuizGrid = Presentational (solo renderiza) |
| **Render Props Pattern** | `components/quiz/TimerBar.tsx` | `<Timer render={(time) => <TimerBar value={time} />} />` — lógica reutilizable con UI variable |

### Patrones de Renderizado (Next.js 15 App Router)

| Patrón | Sigla | Archivos que lo usan |
|--------|-------|----------------------|
| Client-Side Rendering | CSR | ``(portal)/quiz/[id]/play/page.tsx` · `(portal)/assistant/page.tsx` · `(portal)/profile/edit/page.tsx` |
| Server-Side Rendering | SSR | `(portal)/dashboard/page.tsx` · `(portal)/quiz/page.tsx` · `(portal)/quiz/[id]/results/page.tsx` |
| Static Rendering | SSG | `(auth)/page.tsx` (landing) · `(auth)/terms/page.tsx` · `not-found.tsx` |
| Incremental Static Generation | ISR | `leaderboard/page.tsx` (revalidate: 60s) · `quiz/[id]/page.tsx` |
| Progressive Hydration | — | `components/ai/WeaknessChart.tsx` · `components/ai/AssistantChat.tsx` |
| Streaming SSR | — | `app/layout.tsx` con Suspense boundaries · `loading.tsx` en cada ruta |
| React Server Components | RSC | `components/layout/Navbar.tsx` · `components/layout/Footer.tsx` · `components/leaderboard/LeaderboardTable.tsx` |
| Selective Hydration | — | Todos los componentes sin `'use client'` — hidratados solo si hay interactividad |

### AI UI Patterns y React Stack 2026

| Patrón | Archivo | Descripción |
|--------|---------|-------------|
| Streaming Response | `components/ai/AssistantChat.tsx` + `hooks/useSSE.ts` | Respuesta IA token a token via SSE stream |
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
| `tmb` | TimerBar | Observer (aria-live) | Reactivo | React + RxJS-like |
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