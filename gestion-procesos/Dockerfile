# syntax=docker/dockerfile:1

# ── Base: Node + pnpm ────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN npm install -g pnpm@12.9.1
WORKDIR /app

# ── Dependencias (se cachean mientras no cambie el lockfile) ─────────────────
FROM base AS deps
# Cypress descarga un binario de ~500 MB que la imagen no necesita (las pruebas e2e se ejecutan fuera de Docker).
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Desarrollo: servidor de Vite con recarga en caliente ─────────────────────
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# ── Compilación de producción ────────────────────────────────────────────────
# Vite incrusta las variables VITE_* al compilar, por eso se reciben como argumentos de build.
FROM deps AS build
ARG VITE_APP_NAME
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FILES_BACKEND=firestore
ENV VITE_APP_NAME=$VITE_APP_NAME \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FILES_BACKEND=$VITE_FILES_BACKEND
COPY . .
# Si las variables llegan vacías, la imagen quedaría inservible (pantalla «Falta configurar Firebase»): se detiene aquí con una explicación.
RUN node scripts/check-env.mjs --strict
RUN pnpm build

# ── Producción: archivos estáticos con Nginx (la app es 100 % CSR) ───────────
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
