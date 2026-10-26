# 🐳 Docker y servidores — cómo levantar y desplegar eCommerce Web3

> Guía única para: (A) levantar todo en **tu equipo** con Docker y (B) **subir la aplicación a un servidor** en internet.
> Todo es open source o gratuito. Azure es opcional y está apagado (`AZURE_ENABLED=false`).
> Comandos para **Git Bash** en Windows (en Linux/macOS son iguales). Se ejecutan desde la **raíz del monorepo** salvo que se indique otra carpeta.

---

## 0. Qué se levanta

| Servicio | Imagen / tecnología | Puerto en tu equipo | Para qué |
|---|---|---|---|
| `postgres` | pgvector/pgvector:pg16 | 5432 | Base transaccional (usuarios, catálogo, pedidos, pagos) + búsqueda FTS/pgvector |
| `mongodb` | mongo:7 | 27017 | Documentos: notificaciones, historial de búsqueda, logs |
| `redis` | redis:7-alpine | 6379 | Caché con TTL, rate limit del login, nonce Web3 (no es fuente de verdad) |
| `mailpit` | axllent/mailpit | 1025 (SMTP) · 8025 (web) | Captura los correos en desarrollo (no se envían a nadie) |
| `ecommerce-express` | Node 20 | 4000 | API REST `/api/v1`, GraphQL, WebSocket, webhooks |
| `ecommerce-next` | Node 20 | 3000 | Tienda (Next.js 15) |
| `gateway` | nginx:1.27-alpine | 8088 (dev) · 80/443 (servidor) | Punto de entrada único: enruta APIs y microfrontends |
| `ecommerce-fastapi` · `ecommerce-rust` · `ecommerce-nuxt` | Python 3.12 · Rust · Node 22 | 8000 · 8080 · 3001 | Fases posteriores (se encienden con su perfil) |

Archivos clave:

| Archivo | Uso |
|---|---|
| `infra/docker/docker-compose.dev.yml` | Entorno local (desarrollo) |
| `infra/docker/docker-compose.prod.yml` | Servidor de producción |
| `infra/nginx/nginx.conf` | Gateway (rutas, compresión, caché, rate limit) |
| `infra/nginx/tls/tls.conf.example` | Plantilla de HTTPS para el servidor |
| `apps/<app>/Dockerfile` | Imagen de cada app (stages `development` y `production`) |
| `apps/<app>/.env.example` · `infra/docker/.env.example` | Plantillas de variables de entorno |
| `.github/workflows/ci.yml` | CI (lint, typecheck, test, nginx -t) y CD (imágenes en ghcr.io) |

---

## PARTE A — Tu equipo (desarrollo)

## 1. Instalar requisitos (una sola vez)

En PowerShell **como administrador** (winget viene con Windows 11):

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e          # Node 22 LTS (Nuxt 4 lo exige; Express y Next funcionan con 20+)
winget install --id Docker.DockerDesktop -e       # Docker Desktop (usa WSL 2)
wsl --install                                     # Si Docker Desktop lo pide; luego reinicia Windows
```

Opcionales (solo si vas a trabajar en esas apps):

```powershell
winget install --id Python.Python.3.12 -e        # FastAPI (Fase 5)
winget install --id Rustlang.Rustup -e            # Rust (Fase 6); pide "Visual Studio Build Tools" con C++
winget install --id Stripe.StripeCli -e           # Probar webhooks de pago en local
```

Luego, en **Git Bash**:

```bash
corepack enable                 # Activa pnpm con la versión fijada en package.json (pnpm 9)
pnpm --version
docker --version && docker compose version
pip install --user uv ruff    # Solo si trabajas en FastAPI
```

**Docker Desktop:**

- Ábrelo y espera a que diga *Engine running*.
- En *Settings → Resources* asigna al menos **6 GB de RAM** (8 GB si vas a encender FastAPI).
- Ahí mismo puedes activar *Start Docker Desktop when you sign in*.

> Si no tienes `cargo` o `ruff`, el pre-commit no falla: los omite con un aviso y la CI los valida. Instálalos para formatear en tu equipo.

## 2. Clonar e instalar dependencias

```bash
git clone <URL-de-tu-repo> ecommerce-web3-enterprise
cd ecommerce-web3-enterprise
pnpm install          # Instala todas las apps Node y activa Husky (git hooks)
```

## 3. Variables de entorno

```bash
cp infra/docker/.env.example infra/docker/.env
cp apps/ecommerce-express/.env.example apps/ecommerce-express/.env
cp apps/ecommerce-next/.env.example apps/ecommerce-next/.env
# Fases posteriores (cuando las uses):
cp apps/ecommerce-fastapi/.env.example apps/ecommerce-fastapi/.env
cp apps/ecommerce-rust/.env.example apps/ecommerce-rust/.env
cp apps/ecommerce-nuxt/.env.example apps/ecommerce-nuxt/.env
```

Genera secretos seguros (uno por variable) y pégalos en los `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

| Variable | Archivo | Valor en desarrollo |
|---|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | express | Secretos distintos (el de acceso también va en FastAPI/Rust) |
| `NEXTAUTH_SECRET` | next | Secreto propio |
| `REVALIDATE_SECRET` | express **y** next | El **mismo** valor en ambos |
| `DATABASE_URL` · `MONGO_URL` · `REDIS_URL` | express | `localhost` (así vienen). En desarrollo con Docker, `docker-compose.dev.yml` pone `postgres`, `mongodb`, `redis` |
| `SMTP_HOST` | express | `localhost` (así viene); en Docker de desarrollo, `mailpit` lo pone el compose |
| `STRIPE_SECRET_KEY` · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | express · next | Claves de **prueba** (`sk_test_`, `pk_test_`) de tu cuenta Stripe |
| `CLOUDINARY_URL`, `FCM_*`, OAuth (`GOOGLE_*`...), Web3/IPFS | varios | Opcionales: sin ellas esas funciones responden 503 o se omiten |

> Los `.env` ya traen `localhost`: Express corre igual en tu equipo (`pnpm dev`) o en Docker (el compose de desarrollo cambia los hosts). En el **servidor** escribe los hosts de Docker (paso 12).

## 4. Levantar Docker (elige una opción)

### Opción 1 — Solo infraestructura en Docker, apps en tu equipo (recomendada para programar)

```bash
pnpm dev:up                                # postgres, mongodb, redis y mailpit
docker compose -f infra/docker/docker-compose.dev.yml ps   # Deben quedar "healthy"
```

### Opción 2 — Todo en Docker (infraestructura + Express + Next.js + gateway)

```bash
docker compose -f infra/docker/docker-compose.dev.yml --profile app up --build -d
docker compose -f infra/docker/docker-compose.dev.yml ps
```

En `apps/ecommerce-next/.env` agrega `INTERNAL_API_URL=http://ecommerce-express:4000/api/v1`.

Para que el navegador pase por el gateway, usa además:

- `NEXT_PUBLIC_API_URL=http://localhost:8088/api/v1` (GraphQL y su WebSocket se derivan: `/graphql`)

### Servicios de fases posteriores (perfiles)

```bash
docker compose -f infra/docker/docker-compose.dev.yml --profile app --profile fastapi up -d --build
# ... --profile rust | --profile nuxt
```

## 5. Base de datos: migraciones y datos iniciales

```bash
pnpm --filter ecommerce-express prisma:generate   # Cliente tipado de Prisma
pnpm --filter ecommerce-express prisma:deploy     # Aplica TODAS las migraciones (prisma/migrations)
pnpm --filter ecommerce-express prisma:seed       # Roles, permisos, admin inicial y catálogo de ejemplo
```

- El admin inicial sale de `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; por defecto es `admin@ecommerce.local` / `Admin12345!`. Cámbialo.
- Estos comandos corren en tu equipo, así que en `DATABASE_URL` el host debe ser `localhost`.
- Para explorar los datos: `pnpm --filter ecommerce-express prisma:studio`.

## 6. Correr las apps (Opción 1)

En dos terminales:

```bash
pnpm --filter ecommerce-express dev     # http://localhost:4000
pnpm --filter ecommerce-next dev        # http://localhost:3000
```

O todo a la vez con Turborepo: `pnpm dev`.

## 7. Verificar que todo funciona

| Qué | URL / comando | Esperado |
|---|---|---|
| API viva | http://localhost:4000/health | `{"status":"ok"}` |
| API + base de datos | http://localhost:4000/ready | `{"status":"ready"}` |
| Documentación de la API | http://localhost:4000/api/docs | Swagger UI |
| Tienda | http://localhost:3000 · inglés: http://localhost:3000/en | Catálogo |
| Gateway (Opción 2) | http://localhost:8088 · http://localhost:8088/gateway/health | Tienda · `ok` |
| Correos | http://localhost:8025 | Bandeja de Mailpit |
| Webhooks de Stripe | `stripe listen --forward-to localhost:4000/webhook/payment` | Copia el `whsec_...` en `STRIPE_WEBHOOK_SECRET` |
| Calidad | `pnpm lint && pnpm typecheck && pnpm test` | Todo en verde |

## 8. Comandos Docker del día a día

```bash
C="docker compose -f infra/docker/docker-compose.dev.yml"
$C ps                                  # Estado de los contenedores
$C logs -f ecommerce-express           # Logs en vivo de un servicio
$C restart ecommerce-next              # Reiniciar uno
$C --profile app up -d --build         # Reconstruir tras cambiar dependencias o un Dockerfile
docker stats                           # Consumo de CPU y RAM por contenedor
pnpm dev:down                          # Apagar (CONSERVA los datos)
$C down -v                             # Apagar y BORRAR los datos (volúmenes) — irreversible
docker system prune                    # Liberar disco (imágenes y capas sin usar)
```

## 9. Probar las imágenes de producción en tu equipo

```bash
docker build -f apps/ecommerce-express/Dockerfile --target production -t ecommerce-express:local .
docker build -f apps/ecommerce-next/Dockerfile --target production \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8088/api/v1 \
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:8088 -t ecommerce-next:local .
docker build -f apps/ecommerce-nuxt/Dockerfile --target production -t ecommerce-nuxt:local .
docker build -f apps/ecommerce-rust/Dockerfile --target production -t ecommerce-rust:local .
docker build -f apps/ecommerce-fastapi/Dockerfile --target production -t ecommerce-fastapi:local .   # Pesada (TensorFlow)
```

> Las variables `NEXT_PUBLIC_*` se **incrustan al construir** la imagen de Next.js. Si cambian (por ejemplo, el dominio), hay que reconstruirla.

---

## PARTE B — Servidor en internet (producción)

## 10. Qué necesitas

| Recurso | Mínimo | Opciones gratuitas o baratas |
|---|---|---|
| Servidor Linux (Ubuntu 24.04 LTS) | 2 vCPU · 4 GB RAM · 40 GB disco (Express + Next + bases de datos) | Oracle Cloud *Always Free* (ARM, hasta 4 vCPU/24 GB), o un VPS de ~5 USD/mes |
| Dominio | Uno (ej. `tutienda.com`) | Registrador a elección; DNS gratis en Cloudflare |
| Certificado HTTPS | — | Let's Encrypt (gratis, se renueva solo) |
| Registro de imágenes | — | GitHub Container Registry (`ghcr.io`, gratis) |
| Correo real | Servidor SMTP | Proveedor SMTP con plan gratuito (reemplaza a Mailpit) |

> **ARM (Oracle Always Free):** las imágenes de la CD se construyen para `amd64`. Hay dos salidas:
> - Construir en el servidor (paso 14, opción B).
> - Agregar `platforms: linux/amd64,linux/arm64` en el job `images` de `ci.yml`.

## 11. Preparar el servidor (una sola vez)

Conéctate por SSH (`ssh usuario@IP_DEL_SERVIDOR`) y ejecuta:

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Docker Engine + plugin compose (script oficial de Docker)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker      # Usar docker sin sudo
docker compose version

# Firewall: solo SSH, HTTP y HTTPS abiertos (Postgres/Mongo/Redis NUNCA se exponen)
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable

# Swap de 2 GB: evita que el sistema mate procesos por falta de memoria en picos
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Git y certbot
sudo apt install -y git certbot
```

En tu proveedor de DNS crea un registro **A** `tutienda.com` → IP del servidor (y `www` si lo usas).

## 12. Código y variables de entorno en el servidor

```bash
git clone <URL-de-tu-repo> ~/ecommerce && cd ~/ecommerce
cp infra/docker/.env.example infra/docker/.env
cp apps/ecommerce-express/.env.example apps/ecommerce-express/.env
cp apps/ecommerce-next/.env.example apps/ecommerce-next/.env
nano infra/docker/.env      # y cada .env (valores de PRODUCCIÓN)
```

Valores de producción (reemplaza `tutienda.com`):

| Archivo | Variable | Valor |
|---|---|---|
| `infra/docker/.env` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `MONGO_USER`, `MONGO_PASSWORD` | Usuarios y contraseñas **largas y únicas** |
| `infra/docker/.env` | `GHCR_OWNER` · `IMAGE_TAG` | Tu usuario de GitHub en minúsculas · `latest` |
| `infra/docker/.env` | `GATEWAY_PORT` | `80` |
| express | `NODE_ENV` | `production` (además apaga Swagger `/api/docs`) |
| express | `DATABASE_URL` | `postgresql://USUARIO:CLAVE@postgres:5432/ecommerce_db` |
| express | `MONGO_URL` | `mongodb://USUARIO:CLAVE@mongodb:27017/ecommerce_docs?authSource=admin` |
| express | `REDIS_URL` | `redis://redis:6379` |
| express | `API_BASE_URL` · `FRONTEND_URL` | `https://tutienda.com` |
| express | `CORS_ORIGINS` | `https://tutienda.com` |
| express | `STOREFRONT_REVALIDATE_URL` | `http://ecommerce-next:3000/api/revalidate` |
| express | `SMTP_*` | Tu proveedor SMTP real |
| express | `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` | Claves **live** y el secreto del webhook de producción (paso 16) |
| express | `JWT_*`, `REVALIDATE_SECRET`, `SEED_ADMIN_*` | Secretos nuevos (nunca los de desarrollo) |
| next | `NEXTAUTH_URL` · `NEXT_PUBLIC_SITE_URL` | `https://tutienda.com` |
| next | `NEXT_PUBLIC_API_URL` | `https://tutienda.com/api/v1` (GraphQL en `https://tutienda.com/graphql`, WebSocket en `wss://tutienda.com/graphql`) |
| next | `NEXTAUTH_SECRET`, `REVALIDATE_SECRET` | Secretos (el de revalidación igual al de Express) |
| next | `ALLOW_INDEXING` | `true` (permite que Google indexe la tienda) |

> Los `.env` **no se suben al repositorio** (`.gitignore` los excluye). Guárdalos también en un gestor de contraseñas.

## 13. Certificado HTTPS (Let's Encrypt)

```bash
# 1) Pedir el certificado (el puerto 80 debe estar libre: aún no hay gateway corriendo)
sudo certbot certonly --standalone -d tutienda.com -d www.tutienda.com -m tu-correo@dominio.com --agree-tos -n

# 2) Activar HTTPS en el gateway
cp infra/nginx/tls/tls.conf.example infra/nginx/tls/tls.conf
sed -i 's/TU_DOMINIO/tutienda.com/g' infra/nginx/tls/tls.conf

# 3) Renovación automática: certbot libera el puerto 80 un momento y vuelve a encender el gateway
P="docker compose -f $HOME/ecommerce/infra/docker/docker-compose.prod.yml --env-file $HOME/ecommerce/infra/docker/.env"
sudo certbot renew --dry-run --pre-hook "$P stop gateway" --post-hook "$P start gateway"
```

certbot deja programada la renovación (timer de systemd) y recuerda los hooks después de un `renew` exitoso.

## 14. Imágenes de la aplicación (elige una opción)

### Opción A — Desde la CD de GitHub Actions (recomendada)

1. En GitHub: **Settings → Secrets and variables → Actions → Variables** crea:
   - `NEXT_PUBLIC_API_URL` = `https://tutienda.com/api/v1`
   - `NEXT_PUBLIC_SITE_URL` = `https://tutienda.com`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = tu `pk_live_...`
2. Haz push a `main`. Si la CI pasa, el job `images` publica `ghcr.io/<usuario>/ecommerce-express` y `ecommerce-next` con las etiquetas `latest` y `<sha>`.
3. Si el repositorio es **privado**, inicia sesión en el servidor con un token de GitHub (permiso `read:packages`):

```bash
echo <TOKEN> | docker login ghcr.io -u <usuario> --password-stdin
```

### Opción B — Construir en el servidor (sin registro)

Pon los mismos `NEXT_PUBLIC_*` en `infra/docker/.env` y usa `build` en lugar de `pull` en el paso siguiente.
Construir Next.js necesita unos 2 GB de RAM libres (la swap del paso 11 ayuda).

## 15. Levantar la aplicación

```bash
cd ~/ecommerce
P="docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env"

$P pull                   # Opción A  (o: $P build   para la Opción B)
$P up -d postgres mongodb redis     # Primero las bases de datos
$P ps                               # Esperar a que estén "healthy"
```

**Migraciones y datos iniciales** (contenedor temporal con el código del repo, en la red interna de Docker):

```bash
docker run --rm --network ecommerce-prod_ecommerce-net \
  --env-file apps/ecommerce-express/.env -v "$PWD":/repo -w /repo node:20-alpine sh -c \
  "corepack enable && pnpm install --frozen-lockfile --filter ecommerce-express... && \
   cd apps/ecommerce-express && pnpm prisma:generate && pnpm prisma:deploy && pnpm prisma:seed"
```

> El seed se corre **una sola vez** (crea roles, permisos y el admin de `SEED_ADMIN_*`). En despliegues posteriores basta `pnpm prisma:deploy`.

**Encender las apps y el gateway:**

```bash
$P up -d
$P ps          # express, next y gateway "running"/"healthy"
curl -I https://tutienda.com                    # 200
curl https://tutienda.com/gateway/health        # ok
```

## 16. Configuración de servicios externos (producción)

| Servicio | Qué configurar |
|---|---|
| Stripe | *Developers → Webhooks → Add endpoint* `https://tutienda.com/webhook/payment` (eventos `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.requires_action` y `payment_intent.canceled`). Copia el `whsec_...` en `STRIPE_WEBHOOK_SECRET` y reinicia Express |
| Google / GitHub / Discord (OAuth) | URL de callback: `https://tutienda.com/api/auth/callback/<proveedor>` |
| Cloudinary · FCM · IPFS | Credenciales en el `.env` de Express (opcionales) |
| Azure (opcional) | `AZURE_ENABLED=true` y sus variables; si Azure falla, el sistema vuelve solo a `.env`, winston y SMTP |

Tras cambiar un `.env`: `$P up -d` (recrea solo los contenedores afectados).

## 17. Actualizar, volver atrás y copias de seguridad

```bash
# Nueva versión (tras un push a main con la CI en verde)
cd ~/ecommerce && git pull
$P pull && $P up -d
# + migraciones si el cambio las trae (paso 15, solo "pnpm prisma:deploy")

# Volver a una versión anterior: en infra/docker/.env pon IMAGE_TAG=<sha-del-commit>, luego:
$P pull && $P up -d

# Copia de seguridad diaria (agrégalo con "crontab -e"; guarda 7 días)
0 3 * * * cd ~/ecommerce && mkdir -p backups && docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env exec -T postgres pg_dump -U <POSTGRES_USER> ecommerce_db | gzip > backups/pg_$(date +\%F).sql.gz && find backups -mtime +7 -delete

# MongoDB (manual)
$P exec -T mongodb mongodump -u <MONGO_USER> -p <MONGO_PASSWORD> --authenticationDatabase admin --archive --gzip > backups/mongo_$(date +%F).gz

# Restaurar Postgres
gunzip -c backups/pg_AAAA-MM-DD.sql.gz | $P exec -T postgres psql -U <POSTGRES_USER> ecommerce_db
```

Copia la carpeta `backups/` fuera del servidor de vez en cuando (tu equipo o un almacenamiento externo).

## 18. Monitoreo y consumo de recursos

```bash
$P ps                    # Estado y healthchecks
$P logs -f --tail=100 ecommerce-express
docker stats             # RAM/CPU por contenedor (cada uno tiene "mem_limit": nunca se come todo el servidor)
df -h && free -h         # Disco y memoria del servidor
```

Límites de memoria del compose de producción:

| Servicio | Límite |
|---|---|
| gateway | 64 MB |
| redis | 192 MB |
| express | 448 MB |
| next | 512 MB |
| postgres | 512 MB |
| mongodb | 512 MB |

En total unos 2,3 GB. Con FastAPI suma 1 GB y con Rust, 128 MB.

Los logs rotan solos: máximo 30 MB por contenedor.

## 19. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `port is already allocated` (5432, 27017, 6379, 80, 8088) | Otro programa o contenedor usa el puerto (por ejemplo, otro Postgres o Mongo de otro proyecto) | Detén el otro (`docker ps`, `docker stop <id>`) o cambia el puerto del lado izquierdo en el compose |
| `Cannot connect to the Docker daemon` / `dockerDesktopLinuxEngine` | Docker Desktop apagado | Ábrelo y espera *Engine running* |
| Descargas de imágenes con `Client.Timeout exceeded` | Red lenta o Docker Hub saturado | Reintenta; revisa proxy/VPN |
| El contenedor se reinicia en bucle (`Restarting`) | Falta una variable o el `.env` | `$P logs <servicio>`: Express valida todas sus variables al arrancar y dice cuál falta |
| `502 Bad Gateway` en una ruta | Ese servicio está apagado o arrancando | `$P ps`; los perfiles `fastapi`, `rust` y `nuxt` no se encienden solos |
| La tienda llama a `localhost:4000` en producción | La imagen de Next se construyó sin `NEXT_PUBLIC_*` | Define las variables (paso 14) y reconstruye |
| Error CORS | `CORS_ORIGINS` no incluye el dominio | Pon `https://tutienda.com` y reinicia Express |
| El login con Google falla | Callback mal registrado | Paso 16 |
| El pago queda "Confirmando…" | El webhook no llega | Revisa el endpoint en Stripe y `STRIPE_WEBHOOK_SECRET` |
| `certbot` falla | DNS aún no apunta al servidor o el puerto 80 está ocupado | `dig tutienda.com`; `$P stop gateway` y reintenta |
| El pre-commit avisa "cargo no está instalado" | Rust no instalado en tu equipo | No bloquea; instala rustup para formatear en local |

## 20. Lista de verificación final

- [ ] `pnpm lint && pnpm typecheck && pnpm test` en verde y CI de GitHub en verde
- [ ] `.env` de producción con secretos nuevos (nada de `change-me` ni claves de prueba)
- [ ] DNS apuntando al servidor y HTTPS activo (candado en el navegador)
- [ ] Firewall: solo 22, 80 y 443 abiertos
- [ ] Migraciones aplicadas y admin inicial con contraseña cambiada
- [ ] Webhook de Stripe y callbacks OAuth con el dominio real
- [ ] Copia de seguridad programada y probada (restaurar al menos una vez)
- [ ] Renovación del certificado probada (`certbot renew --dry-run`)
