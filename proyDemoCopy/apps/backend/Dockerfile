# syntax=docker/dockerfile:1.6
# [Imagen del backend NestJS]: build multi-etapa (compila → imagen final solo con dependencias de producción)
# [Node 24.22.1 LTS]: misma versión en las dos etapas, en CI (NODE_VERSION) y en .nvmrc | [Principio]: Reproducibilidad

# ───────────── Etapa 1: dependencias + compilación ─────────────
FROM node:24.22.1-alpine AS builder
WORKDIR /app

# pnpm fijado a la versión con la que se generó pnpm-lock.yaml (lockfile v9)
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Lockfile primero: Docker reutiliza la caché de dependencias si solo cambia el código
COPY package.json pnpm-lock.yaml ./
# `HUSKY=0` + `--ignore-scripts` en el prune: los git hooks (Husky) no aplican dentro de la imagen y su binario se elimina con las devDependencies
ENV HUSKY=0
RUN pnpm install --frozen-lockfile

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm build \
    && pnpm prune --prod --ignore-scripts

# ───────────── Etapa 2: ejecución ─────────────
FROM node:24.22.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Usuario sin privilegios "node" (incluido en la imagen oficial); --chown evita un chown -R lento
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
# [Subidas]: la carpeta del volumen existe con dueño «node» → Docker copia ese dueño al crear un volumen vacío (sin esto queda de root y falla con EACCES)
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://localhost:4000/api/v1/courses?limit=1" >/dev/null || exit 1

CMD ["node", "dist/main.js"]
