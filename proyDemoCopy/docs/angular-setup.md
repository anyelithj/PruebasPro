# 🅰️ Angular 22 — Setup completo con pnpm

> **Stack:** Angular 22.2 · TypeScript 6 · Signals + RxJS · Signal Forms · Zod 4 · Tailwind CSS 4 · tw-animate-css · @angular/elements · @angular/cdk · Jest 30 + jest-preset-angular · msw 2 · Playwright · ESLint 9 (angular-eslint)
> **Arquitectura:** Angular Microfrontend (remoto del shell Next.js) · Feature-Based Clean Architecture · Atomic Design · BFF compartido (`/api/*` de Next.js)
> **Ubicación:** `apps/frontend-angular/` · servidor en `http://localhost:9100/ng/` · pantallas a través del shell en `http://localhost:9000`
> **Estructura:** ver `angular_estructura.md` (mismo árbol que la hoja «🅰️ Angular 22» de la matriz)

---

## 0. Requisitos

```bash
# Angular 22 exige Node ≥ 22.22.3 (o ≥ 24.15). Con nvm-windows:
nvm install 22.22.3        # Descarga la versión (no cambia la activa)
nvm use 22.22.3            # La activa para toda la terminal (Next.js 16 y NestJS 11 también funcionan con ella)
node -v                    # → v22.22.3

# pnpm (gestor del monorepo)
corepack enable            # Activa pnpm incluido en Node
pnpm -v                    # → 10.x
```

---

## 1. Crear el proyecto

```bash
# Desde la raíz del monorepo (proyDemoCopy/apps)
cd apps

# `ng new` sin instalar Angular CLI global: npx usa la versión exacta
# --directory frontend-angular → carpeta del remoto (apps/frontend-angular)
# --style tailwind             → Tailwind 4 con @tailwindcss/postcss (.postcssrc.json)
# --routing                    → app.routes.ts con rutas lazy
# --ssr=false                  → remoto estático (lo sirve Nginx / lo reescribe Next.js)
# --zoneless                   → sin zone.js: detección de cambios por signals
# --skip-git                   → el monorepo ya tiene git
# --prefix aula                → selectores <aula-*>
npx -y @angular/cli@22.2.3 new aula \
  --directory frontend-angular \
  --style tailwind \
  --routing \
  --ssr=false \
  --zoneless \
  --skip-git \
  --package-manager pnpm \
  --prefix aula \
  --ai-config none \
  --interactive=false

cd frontend-angular

# Limpiar lo que genera el CLI y no usa la arquitectura (los componentes van con plantilla inline)
rm -f src/app/app.ts src/app/app.html src/app/app.css src/app/app.spec.ts README.md
rm -rf .vscode
mv .prettierrc .prettierrc.json
```

---

## 2. Instalar dependencias de producción

```bash
# Angular Elements (<aula-exportar>, <aula-campana> dentro de Next.js) y CDK (DragDrop, a11y)
pnpm add @angular/elements@^22.2.0 @angular/cdk@^22.2.0

# Validación y contratos tipados (los mismos esquemas que usa Next.js)
pnpm add zod@^4.6.7

# Animaciones utilitarias (las importa globals.css del shell)
pnpm add tw-animate-css
```

---

## 3. Instalar dependencias de desarrollo

```bash
# Quitar Vitest (runner por defecto de Angular 22): el monorepo usa Jest como Next.js y NestJS
pnpm remove vitest

# Testing unitario e integración (Jest + Angular sin zone.js + msw sobre fetch)
pnpm add -D jest@^30 jest-preset-angular@^17 @types/jest@^30 \
  jest-environment-jsdom@^30 jest-fixed-jsdom \
  msw@^2 ts-node @types/node@^22

# Testing E2E y usabilidad
pnpm add -D @playwright/test@^1.60.0
pnpm exec playwright install chromium firefox   # Navegadores de Playwright (una sola vez)

# Calidad de código (reglas de capas + plantillas accesibles)
pnpm add -D eslint@^9 typescript-eslint angular-eslint@^22
```

> En `package.json` se permite el script de instalación de msw: `"pnpm": { "onlyBuiltDependencies": ["msw"] }`.

---

## 4. Crear estructura de carpetas

> Ejecutar desde `apps/frontend-angular/` en Git Bash. Árbol completo y comentarios por archivo en `angular_estructura.md`.

```bash
# ── core/ — una vez por app (sesión, HTTP, i18n, tema, eventos aula:*) ──
mkdir -p src/app/core/{auth,events,http,i18n,theme}

# ── shared/ — Atomic Design + utilidades usadas por 2+ funcionalidades ──
mkdir -p src/app/shared/ui/atoms/{badge,button,icon,spinner,text-input} \
  src/app/shared/ui/molecules/form-field \
  src/app/shared/ui/organisms/data-table \
  src/app/shared/ui/templates \
  src/app/shared/{pipes,utils}
touch src/app/shared/pipes/.gitkeep src/app/shared/utils/.gitkeep

# ── features/ — una carpeta por funcionalidad con las cuatro capas (fases 0–6) ──
for f in assistant feedback notifications own-llm reports; do
  mkdir -p src/app/features/$f/{domain/models,application,infrastructure,presentation/pages}
done
mkdir -p src/app/features/{assistant,notifications,own-llm,reports}/presentation/components

# ── __tests__/ — misma organización que apps/frontend-next/__tests__ y apps/backend/__tests__ ──
mkdir -p __tests__/unit/{features,shared/ui/atoms} \
  __tests__/integration/features \
  __tests__/{functional,usability} \
  __tests__/utils/msw

# ── estáticos y herramientas ──
mkdir -p public/{fonts,icons,images} tools/feature-template
touch public/fonts/.gitkeep public/icons/.gitkeep public/images/.gitkeep
```

**Funcionalidad nueva:** copiar `tools/feature-template/__name__/` a `src/app/features/<nombre>/` y `tools/feature-template/__tests__/*` a `__tests__/{unit,integration}/features/<nombre>/`, reemplazar `__name__`/`__Name__`, registrar la ruta en `src/app/app.routes.ts`, el prefijo en `apps/frontend-next/src/config/angular.ts` (rewrites) y el prefijo de la API en `apps/frontend-next/src/lib/bff/forward.ts`.

---

## 5. Archivos de configuración clave

| Archivo | Qué configura |
|---------|---------------|
| `angular.json` | `deployUrl: "/ng/"`, `outputHashing: "none"` (main.js estable para los Angular Elements), `serve` en `:9100` con `servePath: "/ng/"` y `proxy.conf.json` |
| `src/index.html` | `<base href="/ng/">` (assets) — el router usa `APP_BASE_HREF "/"` en `app.config.ts` |
| `src/styles.css` | `@import '../../frontend-next/src/app/globals.css'` → mismos 6 temas y utilidades que Next.js |
| `tsconfig.json` | `strict`, `strictTemplates` y alias `@core/*`, `@shared/*`, `@features/*`, `@testing/*` (→ `__tests__/utils`) |
| `proxy.conf.json` | Desarrollo directo en `:9100`: `/api/*` → BFF de Next.js `:9000` |
| `jest.config.ts` + `jest.setup.ts` | `jest-fixed-jsdom`, raíz `__tests__/` (unit + integration), msw y `EventSource` falso |
| `playwright.config.ts` | `__tests__/functional` + `__tests__/usability` contra el shell `:9000` |
| `eslint.config.mjs` | Reglas de capas (`no-restricted-imports`) y accesibilidad en plantillas |

---

## 6. Correr el servidor de Angular

```bash
cd apps/frontend-angular
nvm use 22.22.3                 # Si la terminal está en otra versión de Node
pnpm install                    # Primera vez (o tras cambiar package.json)
pnpm start                      # ng serve --port 9100 → http://localhost:9100/ng/
```

Para usarlo **como en producción (a través del shell)**, con los demás servicios arriba:

```bash
# Terminal 1 — infraestructura (PostgreSQL, Redis, MinIO, MailHog)
docker compose -f docker-compose.dev.yml up -d

# Terminal 2 — backend NestJS (:4000) · reiniciar tras cambios si no se usa watch
cd apps/backend && pnpm start:dev

# Terminal 3 — motor de IA FastAPI (:8000)
cd apps/ai-service && .venv/Scripts/activate && uvicorn src.main:app --reload --port 8000

# Terminal 4 — shell Next.js (:9000)
cd apps/frontend-next && pnpm dev

# Terminal 5 — remoto Angular (:9100)
cd apps/frontend-angular && pnpm start
```

Abrir `http://localhost:9000/login`, iniciar sesión y entrar a:

| Ruta (shell :9000) | Pantalla Angular | Rol |
|--------------------|------------------|-----|
| `/tutor` | Tutor IA con respuesta en streaming | Todos |
| `/redaccion` | Corrector de redacciones (LLM propio) | Todos |
| `/estudio/plan` · `/estudio/recomendaciones` | Plan de estudio y recomendaciones | Todos |
| `/notificaciones` | Bandeja con avisos en vivo (SSE) | Todos |
| `/reportes/exportaciones` | Exportaciones PDF/Excel con estado en vivo | ADMIN |
| `/admin/reports` (página Next.js) | Angular Element `<aula-exportar>` | ADMIN |

---

## 7. Pruebas, calidad y build

```bash
pnpm test                       # Jest: __tests__/unit + __tests__/integration
pnpm test:unit                  # Solo unitarias (fachadas, átomos)
pnpm test:integration           # Repositorios HTTP y páginas con msw
pnpm test:coverage              # Cobertura (mínimo 70 % de líneas)
pnpm lint                       # ESLint: capas + accesibilidad de plantillas
pnpm e2e                        # Playwright (requiere el shell :9000 y una sesión: E2E_EMAIL / E2E_PASSWORD)
pnpm build                      # Producción → dist/frontend-angular/browser (servido bajo /ng/)
```

---

## 8. Docker

```bash
# Desde la raíz del monorepo (el build necesita apps/frontend-next/src/app/globals.css)
docker build -f apps/frontend-angular/Dockerfile -t aula-frontend-angular .
docker run --rm -p 9100:9100 aula-frontend-angular   # Nginx sirve /ng/ en :9100
# En Next.js: ANGULAR_URL=http://<host>:9100 para los rewrites
```

---

## 9. Problemas comunes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `The Angular CLI requires a minimum Node.js version of v22.22.3` | Node activo más viejo | `nvm use 22.22.3` |
| `/tutor` en blanco y 404 de `main.js` | Falta `<base href="/ng/">` o el remoto no está arriba | Revisar `src/index.html` y `pnpm start` |
| Texto con fuente serif | Fuera de Next.js no existe `--font-inter` | Ya cubierto en `styles.css` (`:where(:root)`) |
| `/api/events` o `/ai/assistant/chat/stream` → 404 | Backend NestJS con código anterior | Reiniciar NestJS |
| `jest` termina sin imprimir nada | Hook de la extensión Console Ninja en `node_modules/jest/bin` | `node node_modules/.pnpm/jest-cli@*/node_modules/jest-cli/bin/jest.js` |
