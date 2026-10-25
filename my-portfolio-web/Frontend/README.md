# Portfolio Frontend — Nuxt 3

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Consumo de backends (Nest + FastAPI)

El frontend consume **ambos** backends (`../nest-backend`, `../fastapi-backend`),
que exponen el mismo dominio y el mismo envelope `{ success, data, message }`.

**Selector de backend en runtime** — `apiProvider` (`nest` | `fastapi`), persistido
en cookie `api_provider`. La página `/login` tiene un toggle NestJS ⇄ FastAPI.

Capas añadidas:

| Pieza | Rol |
|-------|-----|
| `composables/useApi.ts` | [FACADE] wrapper de `$fetch`: baseURL por provider, header Bearer, desempaqueta el envelope |
| `stores/useAuthStore.ts` | [FLUX] Pinia: register/login/refresh(rotación)/logout/fetchMe; normaliza camel/snake |
| `stores/useUiStore.ts` | [FLUX] estado UI global |
| `middleware/auth.ts` | [GUARD] protege rutas; redirige a `/login` |
| `layouts/auth.vue` | layout de auth |
| `pages/login.vue` | login/registro + toggle de backend |
| `pages/account.vue` | ruta protegida → `GET /users/me` |
| `pages/api-status.vue` | estado de ambos backends (vía BFF) |
| `server/api/*` | [BFF/PROXY] Nitro: `health` (pinguea ambos), `contact` (forward), `projects` (proxy + fallback), `chat/stream` (SSE stub) |
| `shared/schemas/*` | [DRY] Zod compartido FE↔BE (auth, contact, project) |
| `shared/infrastructure/repositories/ApiProjectsRepository.ts` | [REPOSITORY][OCP] variante API del repo estático |

### Configuración

```bash
cp .env.example .env
# NUXT_PUBLIC_API_PROVIDER=nest|fastapi
# NUXT_PUBLIC_NEST_BASE_URL / NUXT_PUBLIC_FASTAPI_BASE_URL
```

Levanta uno o ambos backends, luego `npm run dev`. Prueba:
`/api-status` (estado), `/login` (auth contra el provider elegido), `/account`.

> Nota: endpoints reales consumidos = **auth** (`/auth/*`) + **users** (`/users/me`).
> `projects`/`contact`/`chat` son stub (501) en backend → el BFF hace fallback.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
