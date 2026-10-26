# 🚀 Guía de Despliegue Local — eCommerce Web3 Enterprise (Fases 0 a 4)

Paso a paso para levantar el monorepo: Docker (PostgreSQL + pgvector, MongoDB, Redis, Mailpit), backend
Express TS (identidad, catálogo, compra, finanzas, fidelidad y notificaciones) y frontend Next.js 15
(tienda, carrito, checkout y cuenta).

> Todo el stack es **open source o gratuito**. Los servicios externos (Stripe, Cloudinary, Firebase, OAuth, IPFS,
> red de pruebas de Polygon) son opcionales: sin credenciales, esa integración responde `503 SERVICE_UNAVAILABLE`
> y el resto de la aplicación sigue funcionando.

---

## 0. Prerrequisitos

```bash
node -v        # Node 20+
pnpm -v        # corepack enable pnpm   (si no está instalado)
docker -v
docker compose version   # 2.24+ (usa "env_file.required")
```

Clona o copia el repositorio y entra a la carpeta raíz:

```bash
cd ecommerce-web3-enterprise
```

---

## 1. Variables de entorno

Copia las plantillas `.env.example` a `.env` (nunca subas los `.env` reales a git):

```bash
cp infra/docker/.env.example infra/docker/.env
cp apps/ecommerce-express/.env.example apps/ecommerce-express/.env
cp apps/ecommerce-next/.env.example apps/ecommerce-next/.env
```

Los `.env.example` usan `localhost` (apps en tu equipo con `pnpm dev`). Dentro de Docker, `docker-compose.dev.yml` reemplaza
esos hosts por los nombres de servicio (`postgres`, `redis`, `mailpit`, `ecommerce-express`...): no hay que editarlos.

| Variable | Dónde | Qué poner | Obligatoria |
|---|---|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | express | `openssl rand -hex 32` (cada uno distinto) | ✅ |
| `NEXTAUTH_SECRET` | next | `openssl rand -hex 32` | ✅ |
| `REVALIDATE_SECRET` | ambos (mismo valor) | `openssl rand -hex 16` — ISR bajo demanda del catálogo | Opcional |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | express | Claves de **modo test** del dashboard de Stripe (gratis) | Para pagar |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | next | Clave publicable de modo test (`pk_test_...`) | Para pagar |
| `CLOUDINARY_URL` | express | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` (plan gratuito) | Para subir imágenes |
| `GOOGLE_*` / `GITHUB_*` / `DISCORD_*` | next | Credenciales OAuth2 de cada consola de desarrollador | Para login social |
| `WEB3_RPC_URL` / `WEB3_PRIVATE_KEY` / `NFT_CONTRACT_ADDRESS` / `IPFS_API_URL` | express | RPC de la testnet Polygon Amoy, wallet de pruebas, contrato ERC-721 y nodo Kubo | Para mintear NFT |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` | express | Cuenta de servicio de un proyecto Firebase (gratuito) | Para push |
| `AZURE_ENABLED` (+ `AZURE_KEY_VAULT_URL`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, `AZURE_COMMUNICATION_CONNECTION_STRING`, `AZURE_EMAIL_SENDER`) | express | Déjalo en `false` (por defecto). Con `true` usa Key Vault, Application Insights y el email de Azure; si Azure falla, vuelve solo a `.env`, logs y SMTP | Opcional |

> Email + contraseña, 2FA, catálogo, carrito, cupones, pedidos, reseñas, puntos y notificaciones internas
> funcionan **sin ninguna** credencial externa. Los correos quedan en Mailpit (paso 4).

---

## 2. Instalar dependencias del monorepo

```bash
pnpm install
```

pnpm workspaces instala todas las apps y paquetes compartidos de una vez (un único store, sin duplicados).
El script `prepare` activa Husky (hooks `pre-commit` y `commit-msg`) si la carpeta ya es un repositorio git.

---

## 3. Git hooks (calidad de código)

```bash
git init        # una sola raíz git para todo el monorepo (si aún no existe)
pnpm install    # vuelve a ejecutar "prepare" => husky
```

Cada `git commit` corre ESLint + Prettier sobre los archivos modificados (lint-staged) y valida el mensaje
con Conventional Commits (`feat:`, `fix:`, `docs:`...).

Husky vive en la **raíz** del monorepo (git tiene un solo juego de hooks por repositorio), así que aplica a **todas** las apps:
Express, Next.js y también Nuxt. Nuxt tiene además su propio `apps/ecommerce-nuxt/.lintstagedrc.json` para que los archivos
`.vue` pasen por ESLint (`@nuxt/eslint`) y Prettier, y los scripts `lint` y `typecheck` (vue-tsc) que Turborepo y la CI ejecutan.

---

## 4. Infraestructura con Docker

### 4.1 Solo infraestructura (recomendado para desarrollar)

```bash
pnpm dev:up      # PostgreSQL + pgvector, MongoDB, Redis y Mailpit
pnpm dev:logs    # logs en vivo
```

Bandeja de correo de pruebas (Mailpit): **http://localhost:8025** — ahí llegan la verificación de cuenta,
los códigos 2FA, la recuperación de contraseña y los emails de pedido/factura.

### 4.2 Todo en Docker (infraestructura + Express + Next.js)

```bash
docker compose -f infra/docker/docker-compose.dev.yml --profile app up --build -d
docker compose -f infra/docker/docker-compose.dev.yml ps
```

`postgres`, `mongodb` y `redis` deben quedar `healthy`; `mailpit`, `ecommerce-express` y `ecommerce-next`, `running`; `gateway`, `healthy`.

**Gateway Nginx (punto de entrada único):** http://localhost:8088 (puerto configurable con `GATEWAY_PORT` en `infra/docker/.env`).
Config en `infra/nginx/nginx.conf`:

| Ruta | Destino |
|---|---|
| `/api/v1/*`, `/api/docs`, `/graphql`, `/socket.io/*`, `/webhook/*` | Express |
| `/ai/*` · `/rs/*` (se quita el prefijo) | FastAPI · Rust (perfiles `fastapi` / `rust`) |
| `/cms`, `/landing`, `/blog`, `/events`, `/pwa`, `/config`, `/_nuxt/*` | Nuxt (perfil `nuxt`) |
| Todo lo demás (tienda, cuenta, checkout, dashboard, `/api/auth`) | Next.js |

Un servicio opcional que no esté levantado responde `502` solo en sus rutas; el resto sigue funcionando.
Para que el navegador use el gateway, en `apps/ecommerce-next/.env`: `NEXT_PUBLIC_API_URL=http://localhost:8088/api/v1`
(GraphQL y sus Subscriptions por WebSocket se derivan: `http://localhost:8088/graphql`).
Si Next.js corre dentro de Docker, define `INTERNAL_API_URL=http://ecommerce-express:4000/api/v1` en su `.env`
(los Server Components llaman al backend por la red interna).

### 4.3 Apagar

```bash
pnpm dev:down                                                     # conserva los datos
docker compose -f infra/docker/docker-compose.dev.yml down -v      # BORRA los volúmenes (reinicio total)
```

---

## 5. Base de datos (Prisma)

Con PostgreSQL arriba, desde `apps/ecommerce-express/`:

```bash
pnpm prisma:generate   # cliente TypeScript tipado a partir de schema.prisma
pnpm prisma:deploy     # aplica la migración inicial (38 tablas, pgvector, índice FTS en español, CHECKs, secuencias)
pnpm prisma:seed       # roles y permisos RBAC, usuario admin, catálogo de ejemplo y cupón BIENVENIDA10
pnpm prisma:studio     # explorador visual (opcional)
```

Usuario administrador del seed: **admin@ecommerce.local** / **Admin12345!** (cámbialo con `SEED_ADMIN_EMAIL` y
`SEED_ADMIN_PASSWORD` antes de sembrar en cualquier entorno compartido).

> `prisma:migrate` (= `prisma migrate dev`) solo se usa al **modificar** el schema: crea una migración nueva.

---

## 6. Backend Express (local)

```bash
cd apps/ecommerce-express
pnpm dev
```

| URL | Qué es |
|---|---|
| http://localhost:4000/health | Liveness (`{"status":"ok"}`) |
| http://localhost:4000/ready | Readiness (verifica PostgreSQL) |
| http://localhost:4000/api/docs | Documentación **OpenAPI 3.0** interactiva (generada desde las rutas; solo fuera de producción) |
| http://localhost:4000/graphql | GraphQL del catálogo (Apollo Server) |

### Endpoints por fase (detalle completo en `/api/docs`)

| Fase | Prefijo `/api/v1/...` | Funcionalidad |
|---|---|---|
| 1 | `auth` | Registro, login, 2FA, refresh (`PATCH sessions/:id`), logout, OAuth2, SIWE (`web3/nonce`, `web3`, `web3/link`), verificación y recuperación |
| 1 | `user`, `role`, `permission` | Perfil, direcciones, wishlist, RBAC, baja GDPR |
| 2 | `product`, `category`, `brand`, `collection`, `media` | Catálogo con variantes, árbol de categorías, imágenes (Cloudinary) |
| 3 | `cart`, `search`, `checkout`, `order`, `payment`, `shipping` | Carrito (Redis), búsqueda FTS/facetas/imagen, saga de checkout, pedidos, Stripe, envíos |
| 4 | `invoice`, `refund`, `coupon`, `loyalty`, `review`, `notification` | Factura DIAN + PDF, reembolsos, cupones, puntos + NFT, reseñas, notificaciones |

Webhook de Stripe (fuera de `/api`): `POST /webhook/payment/stripe`. En local, reenvíalo con la **Stripe CLI** (gratuita):

```bash
stripe listen --forward-to localhost:4000/webhook/payment/stripe   # imprime el whsec_... para STRIPE_WEBHOOK_SECRET
```

---

## 7. Frontend Next.js (local)

```bash
cd apps/ecommerce-next
pnpm dev
```

| Ruta | Pantalla |
|---|---|
| `/` | Home (colección destacada, categorías, fidelidad) |
| `/products`, `/products/[slug]` | Catálogo con filtros y ficha con reseñas (ISR 60 s) |
| `/categories/[slug]`, `/brands/[slug]`, `/collections/[slug]` | Landings del catálogo |
| `/search?q=` | Búsqueda con facetas y por imagen |
| `/login`, `/register`, `/forgot-password`, `/verify/[token]` | Autenticación (email, 2FA, OAuth2, wallet) |
| `/cart` → `/checkout/[id]/address` → `/payment` → `/confirm` | Compra completa |
| `/account/*` | Resumen, pedidos, wishlist, reseñas, fidelidad/NFT, direcciones, notificaciones, ajustes |
| `/sitemap.xml`, `/robots.txt` | SEO técnico (robots bloquea todo salvo con `ALLOW_INDEXING=true`) |
| `/en/...` | Cualquier ruta anterior en inglés (español sin prefijo). Selector de idioma en el pie de página y en Ajustes |

---

## 8. Prueba end-to-end sugerida

1. Levanta la infraestructura (4.1), aplica migraciones y seed (5), y arranca backend y frontend (6 y 7).
2. Regístrate en `/register`; abre Mailpit (http://localhost:8025) y usa el enlace de verificación.
3. Explora `/products`, agrega productos al carrito y aplica el cupón **BIENVENIDA10**.
4. Finaliza la compra: elige dirección y envío, paga con la tarjeta de prueba de Stripe **4242 4242 4242 4242**
   (fecha futura, cualquier CVC) con `stripe listen` activo (paso 6).
5. En `/account/orders` revisa el pedido, descarga la factura PDF y consulta el seguimiento.
6. Deja una reseña del producto, revisa tus puntos en `/account/loyalty` y las notificaciones en la campana.
7. Opcional Web3: en **Ajustes → Seguridad** vincula tu wallet (MetaMask) y luego inicia sesión con
   "Continuar con wallet (Web3)".
8. Como administrador (`admin@ecommerce.local`), prueba los endpoints de catálogo, pedidos y reembolsos desde `/api/docs`.

---

## 9. Comandos del monorepo (Turborepo)

Desde la raíz:

```bash
pnpm build       # compila todas las apps respetando dependencias
pnpm lint        # ESLint en todo el monorepo
pnpm typecheck   # TypeScript strict sin emitir archivos
pnpm test        # pruebas (Jest en Express)
pnpm format      # Prettier
pnpm --filter ecommerce-next i18n:check   # diccionarios es/en completos y con ICU válido
```

Turborepo cachea resultados: una app sin cambios no se vuelve a compilar.

---

## 10. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `P1001: Can't reach database server` | PostgreSQL apagado o host incorrecto | `docker compose ps`; host `localhost` fuera de Docker, `postgres` dentro |
| `Configuración de entorno inválida: JWT_ACCESS_SECRET` | Falta el `.env` del backend | Repite el paso 1 |
| No llegan los correos | `SMTP_HOST` apunta mal | `mailpit` dentro de Docker, `localhost` fuera; revisa http://localhost:8025 |
| El pago queda "Confirmando…" | El webhook de Stripe no llega | Ejecuta `stripe listen` y copia el `whsec_...` a `STRIPE_WEBHOOK_SECRET` |
| `503 SERVICE_UNAVAILABLE` al subir imágenes / mintear NFT | Integración opcional sin credenciales | Configura `CLOUDINARY_URL` o las variables Web3/IPFS |
| La búsqueda por imagen responde 502/503 | El motor de visión (FastAPI, Fase 5) aún no está implementado | Usa la búsqueda por texto |
| CORS desde el frontend | `CORS_ORIGINS` o `NEXT_PUBLIC_API_URL` mal configurados | Verifica `/health` y que el origen esté en la lista |
| `Port 4000 already in use` | Otro proceso usa el puerto | Cambia `PORT` o detén el proceso (`netstat -ano \| findstr :4000` en Windows) |
| Los git hooks no se ejecutan | Husky se instaló antes de `git init` | Repite el paso 3 |
