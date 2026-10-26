# Dockerfile (Docker + Nuxt/Nitro) => multi-stage: dev (HMR) vs producción (servidor Nitro autocontenido).
# Contexto = RAÍZ del monorepo (necesita pnpm-lock.yaml y packages/*):
#   docker build -f apps/ecommerce-nuxt/Dockerfile --target production -t ecommerce-nuxt .
# Patrón Builder (multi-stage) + SRP: cada stage hace una sola cosa.

# ---------- STAGE BASE ----------
# "FROM ... AS" => imagen base con nombre de stage | alpine => imagen mínima
# Node.js 24.22.1 (LTS) fijado por versión exacta (Nuxt 4 necesita las APIs de Set de Node 22+): igual que CI y .nvmrc
FROM node:24.22.1-alpine AS base
# "corepack enable" => activa la versión de pnpm fijada en "packageManager" del package.json raíz
RUN corepack enable
# "WORKDIR" => replica la raíz del monorepo dentro del contenedor
WORKDIR /repo

# ---------- STAGE DEPS: solo manifiestos => capa de dependencias cacheable ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/ecommerce-nuxt/package.json ./apps/ecommerce-nuxt/
# "--filter ecommerce-nuxt..." => instala Nuxt + sus paquetes internos | "--ignore-scripts" => el "postinstall: nuxt prepare"
# necesita el código fuente, que aún no se copió; se ejecuta explícitamente en el stage siguiente
RUN pnpm install --frozen-lockfile --filter ecommerce-nuxt... --ignore-scripts

# ---------- STAGE DEVELOPMENT: usado por docker-compose.dev.yml (target: development) ----------
FROM deps AS development
COPY apps/ecommerce-nuxt ./apps/ecommerce-nuxt
WORKDIR /repo/apps/ecommerce-nuxt
# "nuxt prepare" => genera .nuxt/ (tipos y tsconfig) que el postinstall omitido habría creado
RUN pnpm exec nuxt prepare
EXPOSE 3000
# "--host 0.0.0.0" => el dev server acepta conexiones desde fuera del contenedor
CMD ["pnpm", "exec", "nuxt", "dev", "--host", "0.0.0.0"]

# ---------- STAGE BUILD ----------
FROM development AS build
# "nuxt build" => genera .output/ con el servidor Nitro y sus dependencias ya empaquetadas
RUN pnpm run build

# ---------- STAGE PRODUCTION: solo .output (no necesita node_modules) ----------
FROM node:24.22.1-alpine AS production
WORKDIR /app
# "ENV" => NODE_ENV=production activa optimizaciones; HOST/PORT los lee el servidor Nitro
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# "--from=build" => copia solo el artefacto compilado desde el stage anterior
COPY --from=build /repo/apps/ecommerce-nuxt/.output ./.output
# "USER node" => no corre como root (mínimo privilegio)
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
