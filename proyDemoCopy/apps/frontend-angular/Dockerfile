# [Dockerfile · remoto Angular 22]: build estático multi-etapa servido con Nginx en :9100 | [Patrón]: Multi-stage Build | [Rendimiento]: imagen final solo con Nginx + archivos estáticos | [Seguridad]: sin Node ni código fuente en producción
# [Contexto]: la raíz del monorepo (styles.css importa apps/frontend-next/src/app/globals.css) → docker build -f apps/frontend-angular/Dockerfile .

# [Node 24.22.1]: misma versión que CI y .nvmrc (Angular 22 exige ^22.22.3 || ^24.15.0)
FROM node:24.22.1-alpine AS build
WORKDIR /repo
RUN corepack enable
# Tokens de diseño compartidos con Next.js (SSOT)
COPY apps/frontend-next/src/app/globals.css apps/frontend-next/src/app/globals.css
# [Sprint 7.1]: paquetes compartidos del monorepo (alias @aula/* de tsconfig.json) + motion.css que importa globals.css
COPY packages/ packages/
WORKDIR /repo/apps/frontend-angular
COPY apps/frontend-angular/package.json apps/frontend-angular/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/frontend-angular/ ./
# globals.css importa tailwindcss y tw-animate-css desde su carpeta → se instalan junto a él
RUN npm install --no-save --prefix /repo/apps/frontend-next tailwindcss@4 tw-animate-css # Sin package.json → instala solo estas dos
RUN pnpm build

FROM nginx:1.29-alpine
COPY apps/frontend-angular/nginx.conf /etc/nginx/conf.d/default.conf
# El build sale en dist/frontend-angular/browser; se sirve bajo /ng/ (deployUrl)
COPY --from=build /repo/apps/frontend-angular/dist/frontend-angular/browser /usr/share/nginx/html/ng
EXPOSE 9100
