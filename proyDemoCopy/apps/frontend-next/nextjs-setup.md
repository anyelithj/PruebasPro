# ▲ Next.js 15 — Setup completo con pnpm

> **Stack:** Next.js 15 · React 18 · TypeScript 5 · Redux Toolkit · Tailwind CSS · shadcn/ui · Radix UI · Zod · React Hook Form · NextAuth.js  
> **Arquitectura:** MVC + Clean Architecture + Atomic Design + BFF

---

## 1. Crear el proyecto

```bash
# pnpm dlx create-next-app@latest apps/frontend-next \
#   --typescript \
#   --tailwind \
#   --eslint \
#   --app \
#   --src-dir \
#   --import-alias "@/*" \
#   --no-turbopack

pnpm create next-app mi-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd apps/frontend-next
```

---

## 2. Instalar dependencias de producción

```bash
# Estado global y data fetching
pnpm add @reduxjs/toolkit react-redux

# Autenticación
pnpm add next-auth

# Validación y formularios
pnpm add zod react-hook-form @hookform/resolvers

# HTTP client
pnpm add axios

# UI: Radix UI primitivas
pnpm add @radix-ui/react-dialog \
  @radix-ui/react-select \
  @radix-ui/react-tabs \
  @radix-ui/react-tooltip \
  @radix-ui/react-progress \
  @radix-ui/react-avatar \
  @radix-ui/react-separator \
  @radix-ui/react-label

# shadcn/ui (inicializar después de Radix)
pnpm dlx shadcn@latest init

# Utilidades de estilos
pnpm add class-variance-authority clsx tailwind-merge lucide-react

# Gráficos
pnpm add recharts

# Temas (dark/light)
pnpm add next-themes
```

---

## 3. Instalar dependencias de desarrollo

```bash
# Testing unitario e integración
pnpm add -D jest jest-environment-jsdom \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  jest-axe \
  msw

# Testing E2E y usabilidad
pnpm add -D playwright @playwright/test axe-playwright

# Rendimiento
pnpm add -D @lhci/cli @next/bundle-analyzer

# Calidad de código
pnpm add -D prettier prettier-plugin-tailwindcss \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  lint-staged husky
```

---

## 4. Crear estructura de carpetas y archivos

> Ejecutar desde la raíz de `apps/frontend-next/` en Git Bash.

```bash
cd src

# ────────────────────────────────────────────
# app/ — App Router (capa Presentación)
# ────────────────────────────────────────────

# Rutas públicas (sin auth)
mkdir -p app/"(public)"/login \
  app/"(public)"/register \
  app/"(public)"/terms

touch app/"(public)"/layout.tsx \
  app/"(public)"/page.tsx
touch app/"(public)"/login/page.tsx \
  app/"(public)"/login/loading.tsx
touch app/"(public)"/register/page.tsx \
  app/"(public)"/register/loading.tsx
touch app/"(public)"/terms/page.tsx

# Rutas protegidas (requieren JWT)
mkdir -p app/"(protected)"/dashboard \
  app/"(protected)"/quiz/create \
  app/"(protected)"/quiz/"[id]"/play \
  app/"(protected)"/quiz/"[id]"/results \
  app/"(protected)"/leaderboard \
  app/"(protected)"/profile/edit \
  app/"(protected)"/profile/"[username]" \
  app/"(protected)"/assistant

touch app/"(protected)"/layout.tsx
touch app/"(protected)"/dashboard/page.tsx \
  app/"(protected)"/dashboard/loading.tsx
touch app/"(protected)"/quiz/page.tsx \
  app/"(protected)"/quiz/loading.tsx
touch app/"(protected)"/quiz/create/page.tsx \
  app/"(protected)"/quiz/create/loading.tsx
touch app/"(protected)"/quiz/"[id]"/page.tsx \
  app/"(protected)"/quiz/"[id]"/loading.tsx \
  app/"(protected)"/quiz/"[id]"/not-found.tsx
touch app/"(protected)"/quiz/"[id]"/play/page.tsx
touch app/"(protected)"/quiz/"[id]"/results/page.tsx
touch app/"(protected)"/leaderboard/page.tsx \
  app/"(protected)"/leaderboard/loading.tsx
touch app/"(protected)"/profile/page.tsx
touch app/"(protected)"/profile/edit/page.tsx
touch app/"(protected)"/profile/"[username]"/page.tsx
touch app/"(protected)"/assistant/page.tsx

# API Routes — BFF Pattern (NextAuth)
mkdir -p app/api/auth/"[...nextauth]"
touch app/api/auth/"[...nextauth]"/route.ts

# Archivos raíz del app/
touch app/layout.tsx \
  app/page.tsx \
  app/error.tsx \
  app/not-found.tsx \
  app/sitemap.ts \
  app/robots.ts \
  app/globals.css

# ────────────────────────────────────────────
# components/ — Atomic Design
# ────────────────────────────────────────────

mkdir -p components/ui \
  components/quiz \
  components/ai \
  components/leaderboard \
  components/auth \
  components/layout \
  components/shared

# Atoms — shadcn/ui primitivas accesibles
touch components/ui/button.tsx \
  components/ui/input.tsx \
  components/ui/card.tsx \
  components/ui/dialog.tsx \
  components/ui/badge.tsx \
  components/ui/progress.tsx \
  components/ui/skeleton.tsx \
  components/ui/toast.tsx \
  components/ui/tooltip.tsx \
  components/ui/select.tsx \
  components/ui/tabs.tsx \
  components/ui/avatar.tsx \
  components/ui/separator.tsx \
  components/ui/label.tsx

# Molecules — dominio Quiz
touch components/quiz/QuizCard.tsx \
  components/quiz/QuizGrid.tsx \
  components/quiz/QuestionCard.tsx \
  components/quiz/AnswerOption.tsx \
  components/quiz/TimerBar.tsx \
  components/quiz/ScoreDisplay.tsx \
  components/quiz/DifficultyBadge.tsx \
  components/quiz/CategoryIcon.tsx \
  components/quiz/QuizFilter.tsx \
  components/quiz/QuizProgress.tsx

# Molecules — dominio IA
touch components/ai/FeedbackPanel.tsx \
  components/ai/RecommendationCard.tsx \
  components/ai/WeaknessChart.tsx \
  components/ai/AssistantChat.tsx

# Molecules — dominio Ranking
touch components/leaderboard/LeaderboardTable.tsx \
  components/leaderboard/RankBadge.tsx \
  components/leaderboard/UserRankRow.tsx

# Molecules — dominio Auth
touch components/auth/LoginForm.tsx \
  components/auth/RegisterForm.tsx \
  components/auth/OAuthButtons.tsx \
  components/auth/ProtectedRoute.tsx

# Organisms — estructura global
touch components/layout/Navbar.tsx \
  components/layout/Sidebar.tsx \
  components/layout/Footer.tsx \
  components/layout/ThemeProvider.tsx \
  components/layout/PageHeader.tsx

# Shared UI — cross-domain
touch components/shared/ErrorBoundary.tsx \
  components/shared/EmptyState.tsx \
  components/shared/LoadingSpinner.tsx \
  components/shared/Pagination.tsx \
  components/shared/ConfirmDialog.tsx \
  components/shared/SearchBar.tsx \
  components/shared/SEOHead.tsx

# ────────────────────────────────────────────
# store/ — Redux Toolkit + RTK Query
# ────────────────────────────────────────────

mkdir -p store/slices store/api

touch store/index.ts store/provider.tsx
touch store/slices/authSlice.ts \
  store/slices/quizSlice.ts \
  store/slices/uiSlice.ts \
  store/slices/timerSlice.ts
touch store/api/baseApi.ts \
  store/api/authApi.ts \
  store/api/quizApi.ts \
  store/api/scoreApi.ts \
  store/api/aiApi.ts

# ────────────────────────────────────────────
# hooks/ — Custom Hooks (lógica reutilizable)
# ────────────────────────────────────────────

mkdir -p hooks

touch hooks/useAuth.ts \
  hooks/useQuiz.ts \
  hooks/useTimer.ts \
  hooks/useSSE.ts \
  hooks/useDebounce.ts \
  hooks/useMediaQuery.ts \
  hooks/useLocalStorage.ts \
  hooks/useKeyboard.ts

# ────────────────────────────────────────────
# lib/ — Utilidades (capa Infraestructura FE)
# ────────────────────────────────────────────

mkdir -p lib

touch lib/utils.ts \
  lib/auth.ts \
  lib/api-client.ts \
  lib/validations.ts \
  lib/seo.ts \
  lib/constants.ts \
  lib/errors.ts

# ────────────────────────────────────────────
# middleware + types
# ────────────────────────────────────────────

touch middleware.ts

mkdir -p types
touch types/next-auth.d.ts \
  types/env.d.ts \
  types/global.d.ts

# ────────────────────────────────────────────
# __tests__/ — Suite de pruebas completa
# ────────────────────────────────────────────

mkdir -p ../__tests__/unit/components/ui \
  ../__tests__/unit/components/quiz \
  ../__tests__/unit/components/auth \
  ../__tests__/unit/components/shared \
  ../__tests__/unit/hooks \
  ../__tests__/unit/store \
  ../__tests__/unit/lib \
  ../__tests__/unit/a11y \
  ../__tests__/integration \
  ../__tests__/functional \
  ../__tests__/performance \
  ../__tests__/usability

# Unitarias — componentes UI
touch ../__tests__/unit/components/ui/button.test.tsx \
  ../__tests__/unit/components/ui/input.test.tsx \
  ../__tests__/unit/components/ui/dialog.test.tsx

# Unitarias — componentes Quiz
touch ../__tests__/unit/components/quiz/QuestionCard.test.tsx \
  ../__tests__/unit/components/quiz/TimerBar.test.tsx \
  ../__tests__/unit/components/quiz/AnswerOption.test.tsx \
  ../__tests__/unit/components/quiz/ScoreDisplay.test.tsx

# Unitarias — componentes Auth
touch ../__tests__/unit/components/auth/LoginForm.test.tsx \
  ../__tests__/unit/components/auth/RegisterForm.test.tsx

# Unitarias — componentes Shared
touch ../__tests__/unit/components/shared/ErrorBoundary.test.tsx \
  ../__tests__/unit/components/shared/EmptyState.test.tsx

# Unitarias — hooks
touch ../__tests__/unit/hooks/useTimer.test.ts \
  ../__tests__/unit/hooks/useDebounce.test.ts \
  ../__tests__/unit/hooks/useAuth.test.ts \
  ../__tests__/unit/hooks/useLocalStorage.test.ts

# Unitarias — store/slices
touch ../__tests__/unit/store/quizSlice.test.ts \
  ../__tests__/unit/store/authSlice.test.ts \
  ../__tests__/unit/store/timerSlice.test.ts

# Unitarias — lib
touch ../__tests__/unit/lib/utils.test.ts \
  ../__tests__/unit/lib/validations.test.ts

# Unitarias — accesibilidad (jest-axe)
touch ../__tests__/unit/a11y/atoms.a11y.test.tsx \
  ../__tests__/unit/a11y/molecules.a11y.test.tsx

# Integración (Jest + MSW)
touch ../__tests__/integration/QuizPage.test.tsx \
  ../__tests__/integration/QuizPlay.test.tsx \
  ../__tests__/integration/AuthFlow.test.tsx \
  ../__tests__/integration/AssistantChat.test.tsx \
  ../__tests__/integration/Leaderboard.test.tsx \
  ../__tests__/integration/FeedbackPanel.test.tsx

# Funcionales E2E (Playwright)
touch ../__tests__/functional/auth.spec.ts \
  ../__tests__/functional/quiz-flow.spec.ts \
  ../__tests__/functional/ai-feedback.spec.ts \
  ../__tests__/functional/leaderboard.spec.ts \
  ../__tests__/functional/navigation.spec.ts \
  ../__tests__/functional/protected-routes.spec.ts \
  ../__tests__/functional/session-expiry.spec.ts \
  ../__tests__/functional/dark-mode.spec.ts

# Rendimiento (Lighthouse CI + Playwright)
touch ../__tests__/performance/lighthouse.config.js \
  ../__tests__/performance/landing.perf.spec.ts \
  ../__tests__/performance/quiz-page.perf.spec.ts \
  ../__tests__/performance/navigation.perf.spec.ts \
  ../__tests__/performance/bundle.analysis.ts

# Usabilidad (Playwright + axe)
touch ../__tests__/usability/accessibility.spec.ts \
  ../__tests__/usability/keyboard-nav.spec.ts \
  ../__tests__/usability/responsive.spec.ts \
  ../__tests__/usability/cross-browser.spec.ts \
  ../__tests__/usability/dark-mode-contrast.spec.ts \
  ../__tests__/usability/i18n.spec.ts \
  ../__tests__/usability/error-handling-ux.spec.ts

# ────────────────────────────────────────────
# public/ — assets estáticos
# ────────────────────────────────────────────

mkdir -p ../public/icons \
  ../public/images \
  ../public/fonts

# ────────────────────────────────────────────
# Archivos de configuración raíz
# ────────────────────────────────────────────

touch ../components.json \
  ../tailwind.config.ts \
  ../next.config.ts \
  ../jest.config.ts \
  ../jest.setup.ts \
  ../playwright.config.ts \
  ../lighthouserc.js \
  ../.env.local \
  ../.env.example
```
