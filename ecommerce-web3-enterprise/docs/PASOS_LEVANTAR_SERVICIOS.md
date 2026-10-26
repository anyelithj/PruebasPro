# Pasos para levantar los servicios — hoja de comandos

Todos los comandos, en orden, para levantar el proyecto completo: infraestructura en Docker, bases de datos,
backends (Express, FastAPI, Rust), frontends (Next.js, Nuxt), gateway, producción y publicación en GitHub.

- Explicación detallada de variables, endpoints y pruebas: [`GUIA_DESPLIEGUE.md`](GUIA_DESPLIEGUE.md)
- Servidor de producción paso a paso (VPS, HTTPS, copias de seguridad): [`setup/infDocker_y_servidor.md`](setup/infDocker_y_servidor.md)

Los comandos se ejecutan desde la **raíz del monorepo** salvo que se indique otra carpeta.
En Windows, usa **Git Bash** (los `cp` y `openssl` de abajo funcionan ahí; en PowerShell usa `Copy-Item`).

---

## Mapa de servicios y puertos

| Servicio | Contenedor | Puerto local | Perfil de Docker |
|---|---|---|---|
| PostgreSQL 16 + pgvector | `ecommerce-postgres` | 5432 | (siempre) |
| MongoDB 7 | `ecommerce-mongodb` | 27017 | (siempre) |
| Redis 7 | `ecommerce-redis` | 6379 | (siempre) |
| Mailpit (correo de pruebas) | `ecommerce-mailpit` | 1025 SMTP · **8025** web | (siempre) |
| Express (API principal) | `ecommerce-express` | 4000 | `app` |
| Next.js (tienda) | `ecommerce-next` | 3000 | `app` |
| Gateway Nginx | `ecommerce-gateway` | 8088 | `app` |
| FastAPI (IA/ML) | `ecommerce-fastapi` | 8000 | `fastapi` |
| Rust Axum | `ecommerce-rust` | 8080 | `rust` |
| Nuxt (CMS, landing, blog) | `ecommerce-nuxt` | 3001 | `nuxt` |

---

## 1. Requisitos (una sola vez)

```bash
node -v                  # 20 o superior
corepack enable pnpm     # activa pnpm (versión fijada en package.json)
pnpm -v
docker -v
docker compose version   # 2.24 o superior
git --version

# Solo si vas a trabajar en FastAPI o Rust fuera de Docker:
python --version         # 3.12 o 3.13
# FastAPI usa el venv local apps/ecommerce-fastapi/.venv (dependencias con uv), ver B.4
rustup --version         # https://rustup.rs  (incluye cargo y rustfmt)
```

---

## 2. Instalar dependencias y git hooks

```bash
git init                 # solo si la carpeta aún no es un repositorio
pnpm install             # todas las apps Node + paquetes compartidos; activa Husky
```

---

## 3. Variables de entorno

```bash
cp infra/docker/.env.example           infra/docker/.env
cp apps/ecommerce-express/.env.example apps/ecommerce-express/.env
cp apps/ecommerce-next/.env.example    apps/ecommerce-next/.env
cp apps/ecommerce-nuxt/.env.example    apps/ecommerce-nuxt/.env
cp apps/ecommerce-fastapi/.env.example apps/ecommerce-fastapi/.env
cp apps/ecommerce-rust/.env.example    apps/ecommerce-rust/.env

# Secretos (pega cada resultado en su .env)
openssl rand -hex 32     # JWT_ACCESS_SECRET   (express, fastapi y rust: el MISMO valor)
openssl rand -hex 32     # JWT_REFRESH_SECRET  (express)
openssl rand -hex 32     # NEXTAUTH_SECRET     (next)
openssl rand -hex 16     # REVALIDATE_SECRET   (express y next: el MISMO valor)
```

> Los `.env` usan `localhost`: sirven tal cual para correr las apps con `pnpm dev`. Dentro de Docker, `infra/docker/docker-compose.dev.yml` reemplaza esos hosts por los nombres de servicio (`postgres`, `redis`, `mailpit`, `ecommerce-express`), así que no hay que editar nada al cambiar de opción.

---

## 4. Infraestructura en Docker (contenedores)

```bash
pnpm dev:up              # Postgres, MongoDB, Redis y Mailpit en segundo plano
docker compose -f infra/docker/docker-compose.dev.yml ps    # esperar "healthy" en postgres, mongodb y redis
pnpm dev:logs            # logs en vivo (Ctrl+C para salir)
```

Correo de pruebas: http://localhost:8025

---

## 5. Bases de datos

### 5.1 PostgreSQL (Express / Prisma)

La base `ecommerce_db` la crea el contenedor al arrancar por primera vez (variable `POSTGRES_DB`). Las tablas las crea Prisma:

```bash
cd apps/ecommerce-express
pnpm prisma:generate     # genera el cliente tipado desde prisma/schema.prisma
pnpm prisma:deploy       # aplica las migraciones (tablas, pgvector, índices, CHECKs)
pnpm prisma:seed         # roles, permisos, un usuario por rol, catálogo de ejemplo y cupón BIENVENIDA10
pnpm prisma:studio       # (opcional) explorador visual en el navegador
cd ../..
```

#### Usuarios creados por el seed (uno por rol)

Ya vienen **verificados**: inician sesión directo en http://localhost:3000/login sin pasar por el correo.

| Rol | Email | Contraseña | Qué puede hacer hoy (Fases 0–4) |
|---|---|---|---|
| `ADMIN` | `admin@ecommerce.local` | `Admin12345!` | Todos los permisos. Tienda y cuenta en Next; catálogo, pedidos, reembolsos, cupones y roles desde http://localhost:4000/api/docs (el panel `/dashboard` llega en la Fase 7) |
| `VENDOR` | `vendedor@ecommerce.local` | `Vendedor12345!` | Gestiona su catálogo y el despacho de sus pedidos (permisos en `roles.constants.ts`); endpoints desde `/api/docs` |
| `CUSTOMER` | `cliente@ecommerce.local` | `Cliente12345!` | Comprador: catálogo, carrito, cupón `BIENVENIDA10`, checkout, pedidos, reseñas, puntos y notificaciones |

Para probar los endpoints protegidos en `/api/docs`: `POST /api/v1/auth/login` con el email y la contraseña,
copia el `accessToken` de la respuesta y pégalo en el botón **Authorize**.

> ⚠️ Son credenciales de **desarrollo**, públicas en este repositorio. En cualquier servidor compartido o de
> producción, cámbialas en `apps/ecommerce-express/.env` **antes** de ejecutar el seed:
> `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, `SEED_VENDOR_EMAIL` / `SEED_VENDOR_PASSWORD` y
> `SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD`. El seed no modifica usuarios que ya existen.

Cuando **cambies** `schema.prisma`:

```bash
cd apps/ecommerce-express
pnpm prisma:migrate --name descripcion_del_cambio   # crea y aplica una migración nueva
```

Comandos útiles de PostgreSQL:

```bash
# Consola SQL dentro del contenedor
docker exec -it ecommerce-postgres psql -U postgres -d ecommerce_db

# Crear una base adicional (ej. para pruebas)
docker exec -it ecommerce-postgres psql -U postgres -c "CREATE DATABASE ecommerce_test;"

# Borrar todo y volver a migrar + seed (SOLO desarrollo: elimina los datos)
cd apps/ecommerce-express && pnpm exec prisma migrate reset && cd ../..

# Copia de seguridad y restauración
docker exec ecommerce-postgres pg_dump -U postgres ecommerce_db > backup.sql
docker exec -i ecommerce-postgres psql -U postgres -d ecommerce_db < backup.sql
```

### 5.2 FastAPI (Alembic) — misma base PostgreSQL

```bash
cd apps/ecommerce-fastapi
source .venv/Scripts/activate                          # activa el venv (una vez por terminal)
alembic upgrade head                                   # aplica migraciones
alembic revision --autogenerate -m "desc"   # nueva migración tras cambiar modelos
cd ../..
```

### 5.3 Rust (SeaORM)

`apps/ecommerce-rust/migrations/` aún está vacío: no hay migraciones que aplicar hasta implementar su fase.

### 5.4 MongoDB y Redis

No requieren crear nada: MongoDB crea la base y las colecciones con la primera escritura y Redis no tiene esquema.

```bash
docker exec -it ecommerce-mongodb mongosh     # consola de MongoDB
docker exec -it ecommerce-redis redis-cli     # consola de Redis  (KEYS *  ·  FLUSHALL para vaciar la cache)
```

---

## 6. Correr las apps en tu equipo (opción recomendada para programar)

Cada una en su propia terminal, con la infraestructura del paso 4 arriba:

```bash
# Backend Express  -> http://localhost:4000/health  ·  docs: http://localhost:4000/api/docs
pnpm --filter ecommerce-express dev

# Frontend Next.js -> http://localhost:3000
pnpm --filter ecommerce-next dev

# Frontend Nuxt    -> http://localhost:3001
pnpm --filter ecommerce-nuxt dev

# FastAPI          -> http://localhost:8000/health  ·  docs: http://localhost:8000/docs
cd apps/ecommerce-fastapi && .venv/Scripts/uvicorn app.main:app --reload --port 8000

# Rust Axum        -> http://localhost:8080/health
cd apps/ecommerce-rust && cargo run
```

`pnpm dev` en la raíz arranca **todas** las apps Node a la vez (Turborepo).

Webhook de Stripe en local (opcional, para pagos):

```bash
stripe listen --forward-to localhost:4000/webhook/payment/stripe   # copia el whsec_... a STRIPE_WEBHOOK_SECRET
```

---

## 7. Todo dentro de Docker (alternativa al paso 6)

```bash
# Infraestructura + Express + Next.js + gateway Nginx
docker compose -f infra/docker/docker-compose.dev.yml --profile app up --build -d

# Sumar servicios de fases posteriores (se pueden combinar)
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile fastapi --profile rust --profile nuxt up --build -d

# Migraciones y seed dentro del contenedor de Express
docker exec -it ecommerce-express pnpm prisma:deploy
docker exec -it ecommerce-express pnpm prisma:seed
```

Entrada única por el gateway: http://localhost:8088 (rutas en `infra/nginx/nginx.conf`).

### Comandos Docker del día a día

```bash
docker compose -f infra/docker/docker-compose.dev.yml ps                      # estado
docker compose -f infra/docker/docker-compose.dev.yml logs -f ecommerce-express   # logs de un servicio
docker compose -f infra/docker/docker-compose.dev.yml restart ecommerce-next  # reiniciar uno
docker compose -f infra/docker/docker-compose.dev.yml --profile app up --build -d ecommerce-express  # reconstruir uno
docker exec -it ecommerce-express sh                                          # entrar a un contenedor
docker stats                                                                  # consumo de CPU/RAM

pnpm dev:down                                                                 # apagar (conserva datos)
docker compose -f infra/docker/docker-compose.dev.yml --profile app down -v   # apagar y BORRAR volúmenes (datos)
docker system prune                                                           # liberar imágenes/capas sin uso
```

---

## 8. Calidad antes de subir

```bash
pnpm lint                # ESLint en todo el monorepo
pnpm typecheck           # TypeScript strict
pnpm test                # pruebas (Jest en Express)
pnpm build               # build de producción de todas las apps
pnpm --filter ecommerce-next i18n:check
pnpm test:scripts        # pruebas del script que quita comentarios (paso 10)
```

`git commit` ejecuta solo ESLint + Prettier sobre los archivos modificados y valida el mensaje
(Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`...).

---

## 9. Producción (servidor con Docker)

Resumen; el paso a paso completo está en [`setup/infDocker_y_servidor.md`](setup/infDocker_y_servidor.md).

```bash
# Probar las imágenes de producción en tu equipo
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env build
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env up -d

# En el servidor: imágenes publicadas por la CD de GitHub Actions en ghcr.io
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env pull
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env up -d
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env exec ecommerce-express pnpm prisma:deploy
```

---

## 10. Subir a GitHub SIN comentarios

Este repositorio es tu copia de **estudio** (con todos los comentarios). Lo que se sube a GitHub es un repositorio
**espejo** que genera `scripts/publicar-sin-comentarios.mjs`: copia los archivos (respetando `.gitignore`), borra los
comentarios de TS/TSX/JS/JSON, Vue, Python, Rust, CSS, YAML, Dockerfile, nginx, TOML, `.env.example` y Prisma,
y hace commit en el espejo. **Tus archivos locales nunca se modifican.**

Se conservan: directivas (`eslint-disable`, `@ts-expect-error`, `/// <reference>`, `# noqa`, shebang), docstrings de
Python (FastAPI los usa en `/docs`), Markdown y `.sql` (Prisma y sqlx validan el checksum de cada migración).

### Primera vez

```bash
# 1. Crea en GitHub un repositorio VACÍO (sin README), ej. ecommerce-web3-enterprise
# 2. Genera el espejo (se crea en ../ecommerce-web3-enterprise-publico)
pnpm publicar
# 3. Conéctalo a GitHub y súbelo
git -C ../ecommerce-web3-enterprise-publico remote add origin https://github.com/<usuario>/ecommerce-web3-enterprise.git
git -C ../ecommerce-web3-enterprise-publico push -u origin main
```

### Cada vez que quieras publicar

```bash
git add . && git commit -m "feat: ..."        # commit normal aquí (con comentarios)
pnpm publicar                                 # espejo sin comentarios, con el mismo mensaje de commit
pnpm publicar --push                          # ...o generar y subir en un solo paso
pnpm publicar -m "feat: mensaje distinto"     # mensaje propio para el espejo
```

Antes del primer push, revisa el resultado: `git -C ../ecommerce-web3-enterprise-publico show --stat`.
La CI de GitHub (lint, typecheck, test, `cargo fmt --check`, `ruff format --check`) corre sobre el espejo; el script
ejecuta `cargo fmt` y `ruff format` si están instalados para que el formato siga pasando.

> **Respaldo de los comentarios:** el espejo no los tiene, así que si tu disco falla se pierden. Sube también este
> repositorio a un repo **privado** de GitHub: `git remote add origin <url-privada>` y `git push -u origin main`.
> Nunca hagas `push` de este repositorio al repo público.

El JavaScript compilado tampoco lleva comentarios: `packages/tsconfig/base.json` tiene `"removeComments": true`
(afecta a `dist/` de Express); Next.js y Nuxt ya los quitan al minificar en `build`.

---

## 11. Problemas comunes

| Síntoma | Solución |
|---|---|
| `P1001: Can't reach database server` | `docker compose ... ps`; host `localhost` fuera de Docker, `postgres` dentro |
| Puerto ocupado (`EADDRINUSE`) | `netstat -ano \| findstr :4000` y `taskkill /PID <pid> /F` (Windows) |
| Contenedor `unhealthy` | `docker compose -f infra/docker/docker-compose.dev.yml logs <servicio>` |
| Datos corruptos en desarrollo | `down -v` (paso 7) y repetir pasos 4 y 5 |
| Los hooks de git no corren | `pnpm install` de nuevo después de `git init` |
| `pnpm publicar`: "Filename too long" | `git config --global core.longpaths true` |

Más casos en la sección 10 de [`GUIA_DESPLIEGUE.md`](GUIA_DESPLIEGUE.md).
┌──────────┬──────────────────────────┬────────────────┐
│   Rol    │          Email           │   Contraseña   │
├──────────┼──────────────────────────┼────────────────┤
│ ADMIN    │ admin@ecommerce.local    │ Admin12345!    │
├──────────┼──────────────────────────┼────────────────┤
│ VENDOR   │ vendedor@ecommerce.local │ Vendedor12345! │
├──────────┼──────────────────────────┼────────────────┤
│ CUSTOMER │ cliente@ecommerce.local  │ Cliente12345!  │
└──────────┴──────────────────────────┴────────────────┘
////////////////////////////////////////////////////////////////////////
INFORMACIÓN INICIAL

Contenedor (proyecto Docker): **ecommerce-web3** — agrupa `ecommerce-postgres`, `ecommerce-mongodb`, `ecommerce-redis`, `ecommerce-mailpit`, `ecommerce-express`, `ecommerce-next`, `ecommerce-nuxt`, `ecommerce-fastapi`, `ecommerce-rust` y `ecommerce-gateway`.

```bash
# 1. Raíz del proyecto (Git Bash)
cd "/c/Users/angui/Documents/eCommerce Web3-Portafolio/ecommerce-web3-enterprise"

# 2. Variables de entorno (solo la primera vez)
cp infra/docker/.env.example           infra/docker/.env
cp apps/ecommerce-express/.env.example apps/ecommerce-express/.env
cp apps/ecommerce-next/.env.example    apps/ecommerce-next/.env
cp apps/ecommerce-nuxt/.env.example    apps/ecommerce-nuxt/.env
cp apps/ecommerce-fastapi/.env.example apps/ecommerce-fastapi/.env

# 3. Dependencias
pnpm install

# ---------- OPCIÓN A: todo dentro de Docker ----------
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile nuxt --profile fastapi up --build -d
docker exec -it ecommerce-express pnpm prisma:deploy
docker exec -it ecommerce-express pnpm prisma:seed
docker compose -f infra/docker/docker-compose.dev.yml ps

# ---------- OPCIÓN B: bases de datos en Docker y apps en local ----------
# (los .env ya usan localhost: no hay que editarlos; no la combines con la Opción A, usan los mismos puertos)
pnpm dev:up
cd apps/ecommerce-express && pnpm prisma:generate && pnpm prisma:deploy && pnpm prisma:seed && cd ../..

pnpm dev                                            # Express :4000 + Next :3000 + Nuxt :3001 en una sola terminal
cd apps/ecommerce-fastapi && .venv/Scripts/uvicorn app.main:app --reload --port 8000   # otra terminal -> :8000

# Apagar la Opción B: Ctrl+C en cada terminal y luego
pnpm dev:down

# ---------- Apagar la Opción A ----------
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile nuxt --profile fastapi down
```

URLs: tienda http://localhost:3000 · gateway http://localhost:8088 · API docs http://localhost:4000/api/docs · correo http://localhost:8025
 //////////////////////////////////////////////////
 PASO A PASO


> Cada comando indica **en qué carpeta** debes estar en Git Bash (📂) y **para qué sirve**.
> La ruta del proyecto tiene espacios: escríbela siempre **entre comillas**.
> Proyecto Docker de las dos opciones: **`ecommerce-web3`** (así aparece en Docker Desktop).

### Paso 0 — Antes de empezar (una sola vez)

1. Abre **Docker Desktop** y espera a que diga _Engine running_ (sin esto ningún comando `docker` funciona).
2. Abre **Git Bash** y comprueba las herramientas:

```bash
node -v                 # Node 20 o superior
corepack enable pnpm    # activa pnpm (solo la primera vez)
pnpm -v                 # muestra la versión de pnpm
docker compose version  # confirma que Docker responde
```

### Paso 1 — Preparar el proyecto (una sola vez, sirve para A y B)

📂 Raíz del proyecto:

```bash
cd "/c/Users/angui/Documents/eCommerce Web3-Portafolio/ecommerce-web3-enterprise"   # entrar a la raíz

pnpm install   # descarga las dependencias de Express, Next.js, Nuxt y los paquetes compartidos

# Crear los archivos de configuración .env a partir de las plantillas
cp infra/docker/.env.example           infra/docker/.env              # usuario/clave de Postgres y puerto del gateway
cp apps/ecommerce-express/.env.example apps/ecommerce-express/.env    # backend Express
cp apps/ecommerce-next/.env.example    apps/ecommerce-next/.env       # frontend Next.js
cp apps/ecommerce-nuxt/.env.example    apps/ecommerce-nuxt/.env       # frontend Nuxt
cp apps/ecommerce-fastapi/.env.example apps/ecommerce-fastapi/.env    # backend FastAPI
```

> Los `.env` funcionan así para desarrollo. Pagos (Stripe), login social e imágenes (Cloudinary) necesitan sus
> claves; sin ellas esas funciones responden 503 y el resto funciona.

---

## OPCIÓN A — Todo dentro de Docker

Docker crea un contenedor por servicio. No necesitas `pnpm dev`.

### A.1 Docker — bases de datos (crear y encender)

📂 Raíz del proyecto:

```bash
# Descarga las imágenes y CREA + ENCIENDE los contenedores de PostgreSQL, MongoDB, Redis y Mailpit
docker compose -f infra/docker/docker-compose.dev.yml up -d postgres mongodb redis mailpit

# Ver el estado: espera a que postgres, mongodb y redis digan "healthy"
docker compose -f infra/docker/docker-compose.dev.yml ps
```

### A.2 Backend Express (contenedor `ecommerce-express`)

📂 Raíz del proyecto:

```bash
# CONSTRUYE la imagen de Express y CREA + ENCIENDE su contenedor (puerto 4000)
docker compose -f infra/docker/docker-compose.dev.yml --profile app up -d --build ecommerce-express

# BASE DE DATOS: crea las tablas en PostgreSQL (migraciones de Prisma), ejecutado dentro del contenedor
docker exec ecommerce-express pnpm prisma:deploy

# BASE DE DATOS: carga los datos iniciales (roles, usuarios de prueba, catálogo y cupón)
docker exec ecommerce-express pnpm prisma:seed

# Comprobar: debe responder {"status":"ok"}
curl http://localhost:4000/health
```

### A.3 Backend FastAPI (contenedor `ecommerce-fastapi`, opcional)

📂 Raíz del proyecto:

```bash
# CONSTRUYE la imagen (la primera vez tarda bastante: instala TensorFlow) y ENCIENDE el contenedor (puerto 8000)
docker compose -f infra/docker/docker-compose.dev.yml --profile fastapi up -d --build ecommerce-fastapi

curl http://localhost:8000/health   # comprobar
```

### A.4 Frontend Next.js (contenedor `ecommerce-next`) y gateway

📂 Raíz del proyecto:

```bash
# CONSTRUYE y ENCIENDE la tienda Next.js (puerto 3000)
docker compose -f infra/docker/docker-compose.dev.yml --profile app up -d --build ecommerce-next

# ENCIENDE el gateway Nginx: una sola entrada para todos los servicios (puerto 8088)
docker compose -f infra/docker/docker-compose.dev.yml --profile app up -d gateway
```

Abrir: http://localhost:3000 (tienda) · http://localhost:8088 (gateway)

### A.5 Frontend Nuxt (contenedor `ecommerce-nuxt`)

📂 Raíz del proyecto:

```bash
# CONSTRUYE y ENCIENDE Nuxt (puerto 3001)
docker compose -f infra/docker/docker-compose.dev.yml --profile nuxt up -d --build ecommerce-nuxt
```

Abrir: http://localhost:3001

### A.6 Atajo: todo con un solo comando

📂 Raíz del proyecto (reemplaza A.1 a A.5; después ejecuta igual las dos líneas de BASE DE DATOS de A.2):

```bash
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile nuxt --profile fastapi up -d --build
```

### A.7 Día a día (Opción A)

📂 Raíz del proyecto:

```bash
# Ver qué está encendido
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile nuxt --profile fastapi ps
# Ver los logs de un servicio (Ctrl+C para salir)
docker compose -f infra/docker/docker-compose.dev.yml logs -f ecommerce-express
# APAGAR sin borrar nada
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile nuxt --profile fastapi stop
# VOLVER A ENCENDER lo que se apagó
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile nuxt --profile fastapi start
# BORRAR los contenedores (los datos de las bases se conservan)
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile nuxt --profile fastapi down
# BORRAR contenedores Y datos (reinicio total: luego repite A.2 BASE DE DATOS)
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile nuxt --profile fastapi down -v
```

---

## OPCIÓN B — Bases de datos en Docker y aplicaciones en tu equipo

Docker solo corre las bases de datos; Express, Next.js, Nuxt y FastAPI corren en Git Bash y se recargan al guardar.
No la combines con la Opción A: usan los mismos puertos (apaga la A con `stop` antes).

### B.1 Docker — bases de datos (crear y encender)

📂 Raíz del proyecto:

```bash
pnpm dev:up                                               # CREA + ENCIENDE PostgreSQL, MongoDB, Redis y Mailpit
docker compose -f infra/docker/docker-compose.dev.yml ps  # esperar "healthy"
```

### B.2 Base de datos — tablas y datos iniciales

📂 `apps/ecommerce-express`:

```bash
cd "/c/Users/angui/Documents/eCommerce Web3-Portafolio/ecommerce-web3-enterprise/apps/ecommerce-express"

pnpm prisma:generate   # genera el cliente de Prisma (código TypeScript para hablar con la base de datos)
pnpm prisma:deploy     # CREA las tablas en PostgreSQL
pnpm prisma:seed       # CARGA roles, usuarios de prueba, catálogo de ejemplo y cupón
pnpm add -D prisma@latest
pnpm add prisma@latest @prisma/client@latest
pnpm add -w prisma@latest @prisma/client@latest
pnpm prisma init
```

### B.3 Backend Express — Terminal 1

📂 `apps/ecommerce-express`:

```bash
cd "/c/Users/angui/Documents/eCommerce Web3-Portafolio/ecommerce-web3-enterprise/apps/ecommerce-express"
pnpm dev   # ENCIENDE la API en http://localhost:4000 (documentación: http://localhost:4000/api/docs)
```

### B.4 Backend FastAPI — Terminal 2 (opcional)

📂 `apps/ecommerce-fastapi` (requiere Python 3.12 o 3.13; dependencias con **uv**, venv `.venv` de la carpeta):

```bash
cd "/c/Users/angui/Documents/eCommerce Web3-Portafolio/ecommerce-web3-enterprise/apps/ecommerce-fastapi"
source .venv/Scripts/activate                  # activa el venv (una vez por terminal; PowerShell: .venv\Scripts\Activate.ps1)
alembic upgrade head                           # CREA las tablas del motor IA (esquema "ml" de PostgreSQL)
uvicorn app.main:app --reload --port 8000      # ENCIENDE la API de IA en http://localhost:8000 (docs: /docs)
```

Primera vez, o tras cambiar `pyproject.toml`/`uv.lock` (crea/actualiza `.venv` según `uv.lock`; tarda):

```bash
pip install --user uv   # solo si uv no está instalado
uv sync                 # agregar dependencia: uv add <paquete>  |  dev: uv add --dev <paquete>
```

Entrenamientos de modelos ML (otra terminal, misma carpeta). Sin este proceso, `POST /api/v1/ml/prediction/{modelo}/train` responde 202 pero el entrenamiento queda en `QUEUED`:

```bash
celery -A app.worker worker --loglevel=info --pool=solo   # "--pool=solo": Windows no soporta fork
```

### B.5 Frontend Next.js — Terminal 3

📂 `apps/ecommerce-next`:

```bash
cd "/c/Users/angui/Documents/eCommerce Web3-Portafolio/ecommerce-web3-enterprise/apps/ecommerce-next"
pnpm dev   # ENCIENDE la tienda en http://localhost:3000
```

### B.6 Frontend Nuxt — Terminal 4

📂 `apps/ecommerce-nuxt`:

```bash
cd "/c/Users/angui/Documents/eCommerce Web3-Portafolio/ecommerce-web3-enterprise/apps/ecommerce-nuxt"
pnpm dev   # ENCIENDE Nuxt en http://localhost:3001
```

> Atajo: desde la **raíz**, `pnpm dev` enciende Express, Next.js y Nuxt juntos en una sola terminal (reemplaza B.3, B.5 y B.6).

### B.7 Apagar (Opción B)

1. En cada terminal donde corre una aplicación: **Ctrl + C**.
2. 📂 Raíz del proyecto:

```bash
pnpm dev:down   # APAGA y quita los contenedores de bases de datos (los datos se conservan)
```

---

### Entrar a la tienda (A o B)

http://localhost:3000/login — usuarios creados por el seed:

| Rol      | Email                      | Contraseña       |
| -------- | -------------------------- | ---------------- |
| ADMIN    | `admin@ecommerce.local`    | `Admin12345!`    |
| VENDOR   | `vendedor@ecommerce.local` | `Vendedor12345!` |
| CUSTOMER | `cliente@ecommerce.local`  | `Cliente12345!`  |

Correos de prueba (verificación, 2FA, pedidos): http://localhost:8025

---

## 12. Subir al repositorio — paso a paso en Git Bash

Resumen práctico de la sección 10. Todo se hace en **Git Bash**. Este repositorio (con comentarios) **nunca** se sube
al repo público: `pnpm publicar` genera una copia espejo en `../ecommerce-web3-enterprise-publico` **sin
comentarios** y **sin** lo que lista `.gitignore` (`.env`, `node_modules/`, `.venv/`, `.next/`, `.nuxt/`, `dist/`,
`target/`, `coverage/`, logs, modelos de ML...). Solo viajan las plantillas `.env.example`.

### Paso 1 — Ubícate en la raíz del proyecto

```bash
cd "/c/Users/angui/Documents/eCommerce Web3-Portafolio/ecommerce-web3-enterprise"
```

### Paso 2 — Verifica la calidad (mismo chequeo que la CI)

```bash
pnpm lint && pnpm typecheck && pnpm test
```

### Paso 3 — Comprueba que no se cuela nada privado

```bash
# Lista lo que se va a publicar y filtra lo sensible: solo deben salir los .env.example
git ls-files --cached --others --exclude-standard | grep -iE "\.env|\.pem$|\.key$|secret"
```

> Los documentos `docs/especificaciones/*.docx` y `*.xlsx` **sí** se publican. Si no los quieres en GitHub, agrega
> `docs/especificaciones/` al final de `.gitignore` antes del Paso 4.

### Paso 4 — Commit en este repositorio (copia de estudio, con comentarios)

```bash
git add .
git status                       # revisa: NO debe aparecer ningún .env (solo .env.example)
git commit -m "feat(fase-7): analytics, admin e integraciones"
```

El primer commit es obligatorio: `pnpm publicar` reutiliza su mensaje para el espejo.

### Paso 5 — Generar el espejo sin comentarios

```bash
pnpm publicar
# Revisar el resultado antes de subir
git -C ../ecommerce-web3-enterprise-publico show --stat | head -40
```

### Paso 6 — Subir el espejo a GitHub

**Solo la primera vez** (crea antes en GitHub un repositorio **vacío**, sin README):

```bash
git -C ../ecommerce-web3-enterprise-publico remote add origin https://github.com/<usuario>/ecommerce-web3-enterprise.git
git -C ../ecommerce-web3-enterprise-publico push -u origin main
```

**Las siguientes veces** (siempre desde la raíz del Paso 1):

```bash
git add . && git commit -m "feat: ..."   # Paso 4
pnpm publicar --push                      # Pasos 5 + 6 en uno
```

### Paso 7 (recomendado) — Respaldo privado con comentarios

```bash
# Repo PRIVADO distinto del público; aquí sí van los comentarios (nunca los .env)
git remote add origin https://github.com/<usuario>/ecommerce-web3-enterprise-estudio.git
git push -u origin main
```
feat: → nueva funcionalidad
fix: → corrección de un error
refactor: → reorganización del código sin cambiar su comportamiento
docs: → cambios en documentación
style: → cambios de formato/estilo
test: → agregar o modificar pruebas
chore: → tareas de mantenimiento/configuración