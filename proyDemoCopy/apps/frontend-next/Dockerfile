# syntax=docker/dockerfile:1.7
# [Dockerfile · shell Next.js 16]: build multi-etapa (compila → imagen final con .next + dependencias de producción) | [Patrón]: Multi-stage Build | [Seguridad]: usuario sin root, sin código fuente de packages/ ni devDependencies en ejecución
# [Contexto]: la raíz del monorepo (Turbopack resuelve @aula/* desde packages/) → docker build -f apps/frontend-next/Dockerfile .
# [Variables NEXT_PUBLIC_*]: se incrustan en el bundle al compilar → pasarlas con --build-arg si cambian (marca, URL pública)

# ───────────── Etapa 1: dependencias + compilación ─────────────
# [Node 24.22.1]: misma versión que CI (NODE_VERSION) y .nvmrc
FROM node:24.22.1-alpine AS builder
# pnpm fijado igual que CI (PNPM_VERSION) | `corepack` (incluido en Node 24): activa la versión exacta sin npm -g
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /repo
# [Paquetes compartidos]: menú, diccionario, temas y esquemas (@aula/*) que Turbopack compila junto a la app
COPY packages/ packages/
WORKDIR /repo/apps/frontend-next
# Lockfile primero: la capa de dependencias se reutiliza si solo cambia el código | HUSKY=0: sin git hooks en la imagen
COPY apps/frontend-next/package.json apps/frontend-next/pnpm-lock.yaml apps/frontend-next/pnpm-workspace.yaml ./
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile
COPY apps/frontend-next/ ./
ARG NEXT_PUBLIC_APP_URL=http://localhost:9000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# [AUTH_SECRET de build]: NextAuth lo exige para compilar; solo vive en este RUN (no queda en ninguna capa ni en la imagen final) — el real llega en runtime
RUN AUTH_SECRET=build-only-not-a-secret pnpm build \
    && pnpm prune --prod --ignore-scripts

# ───────────── Etapa 2: ejecución ─────────────
FROM node:24.22.1-alpine AS runner
WORKDIR /app/apps/frontend-next
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=9000 HOSTNAME=0.0.0.0
# Usuario «node» de la imagen oficial + `--chown` en cada COPY (sin chown -R lento)
COPY --from=builder --chown=node:node /repo/apps/frontend-next/package.json /repo/apps/frontend-next/next.config.ts ./
# next.config.ts importa src/config/angular.ts (rutas del remoto Angular) → única fuente necesaria en runtime
COPY --from=builder --chown=node:node /repo/apps/frontend-next/src/config ./src/config
COPY --from=builder --chown=node:node /repo/apps/frontend-next/public ./public
COPY --from=builder --chown=node:node /repo/apps/frontend-next/node_modules ./node_modules
COPY --from=builder --chown=node:node /repo/apps/frontend-next/.next ./.next
USER node
EXPOSE 9000
# [Healthcheck]: /robots.txt es estático y no pasa por el proxy de sesión → responde 200 sin cookie
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:9000/robots.txt >/dev/null || exit 1
CMD ["node_modules/.bin/next", "start", "-p", "9000"]
