# Next.js 15 — Estructura de Carpetas

## Tipo de Arquitectura

**MVC + Clean Architecture + Atomic Design + BFF (Backend for Frontend)**

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

