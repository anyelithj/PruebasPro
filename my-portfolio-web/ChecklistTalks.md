# ChecklistTalks — Verificación end-to-end (Backend + Frontend)

Guía paso a paso para comprobar que **todo el stack** funciona y qué está
implementado de verdad vs. lo que es *stub* (esqueleto de la vertical slice).

> **Contexto rápido** — Este portfolio es un *showcase técnico*: el mismo
> frontend Nuxt consume **dos backends distintos** (NestJS y FastAPI) que
> exponen la **misma API**. La autenticación existe para demostrar JWT +
> rutas protegidas en ambos, no porque el portfolio necesite login.

---

## 0. Preguntas frecuentes (léelo antes de empezar)

**¿Por qué no veo el botón de "Iniciar sesión"?**
El navbar (`Frontend/components/layout/Navbar.vue`) solo tiene enlaces
públicos: Inicio / Sobre mí / Proyectos / Contacto. **No hay enlace a login
a propósito** — el portfolio es una página pública. Entras al login **por URL
directa**: `http://localhost:3001/login`.
Si quieres exponerlo, ver §9 (opcional).

**¿Hay un dashboard?**
No. La única ruta protegida es **`/account`**, que solo muestra tu perfil
(`GET /users/me`): id, nombre, email, rol. Es la prueba de que el token
funciona. No hay panel de administración con UI (el CRUD de usuarios existe
en el backend, pero sin pantalla dedicada).

**¿Cómo funciona el registro?**
En `/login` hay un enlace "¿No tienes cuenta? Regístrate" que cambia el
formulario a modo registro (nombre + email + password). Al enviar llama a
`POST /auth/register`, guarda los tokens en cookies y redirige a `/account`.
Mismo flujo para login, contra el backend seleccionado (Nest o FastAPI) con
el toggle que aparece arriba del formulario.

**¿Qué está realmente implementado?**

| Módulo         | Nest        | FastAPI     | Estado          |
|----------------|-------------|-------------|-----------------|
| `auth`         | ✅          | ✅          | Completo        |
| `user`         | ✅          | ✅          | Completo        |
| `project`      | stub        | stub        | Solo esqueleto  |
| `chat`         | stub        | stub        | Solo esqueleto  |
| `contact`      | stub        | stub        | Solo esqueleto  |
| `notification` | stub        | stub        | Solo esqueleto  |

Los *stub* responden `501 Not Implemented` en `/…/health`. Es intencional
(vertical slice: auth + user funcionan de punta a punta; el resto queda
cableado para completar después).

---

## Puertos y rutas base

| Servicio         | Puerto | API base                          | Health                         |
|------------------|--------|-----------------------------------|--------------------------------|
| FastAPI          | 8000   | `http://localhost:8000/api/v1`    | `http://localhost:8000/health` |
| NestJS           | 3000   | `http://localhost:3000/api/v1`    | `http://localhost:3000/health` |
| Frontend (Nuxt)  | 3001   | —                                 | —                              |
| Postgres FastAPI | 5432   | Redis 6379                        |                                |
| Postgres Nest    | 5433   | Redis 6380                        |                                |

> El `/health` está **excluido** del prefijo `/api/v1` en ambos backends.
> El resto de endpoints sí lleva `/api/v1`.

---

## 1. Levantar infraestructura (Docker)

```powershell
cd fastapi-backend; docker compose -f docker-compose.dev.yml up -d; cd ..
cd nest-backend;    docker compose -f docker-compose.dev.yml up -d; cd ..
```

**Verificar que Postgres está sano:**

```powershell
docker ps --filter "name=postgres" --format "{{.Names}}  {{.Ports}}  {{.Status}}"
```

- [ ] `fastapi-backend-postgres-1` → `0.0.0.0:5432->5432` → `healthy`
- [ ] `nest-backend-postgres-1` → `0.0.0.0:5433->5432` → `healthy`

> ⚠️ **Errores de credenciales P1000** casi siempre = puerto equivocado en
> el `.env`. Nest usa Postgres en **5433**, no 5432. Revisa que
> `nest-backend/.env` tenga `DATABASE_URL=...@localhost:5433/...` y
> `REDIS_URL=...localhost:6380/...`.

---

## 2. Migraciones + seed

**FastAPI (Alembic):**

```powershell
cd fastapi-backend
.venv/Scripts/python.exe -m alembic upgrade head
cd ..
```

**NestJS (Prisma) + usuario admin de prueba:**

```powershell
cd nest-backend
npx prisma migrate dev --name init   # primera vez
npm run prisma:seed                  # crea admin@portfolio.dev / admin12345
cd ..
```

- [ ] Migraciones FastAPI aplicadas sin error
- [ ] Migraciones Nest aplicadas (crea tablas `User`, `Session`)
- [ ] Seed Nest ok → existe `admin@portfolio.dev`

---

## 3. Arrancar los backends

Cada uno en su **propia terminal**:

```powershell
# Terminal A — FastAPI
cd fastapi-backend
.venv/Scripts/python.exe -m uvicorn src.main:app --reload --port 8000
```

```powershell
# Terminal B — NestJS
cd nest-backend
npm run start:dev
```

- [ ] FastAPI: log `Uvicorn running on http://0.0.0.0:8000`
- [ ] Nest: log `API up on :3000/api/v1`

---

## 4. Verificar Health (backend vivo)

```powershell
curl.exe http://localhost:8000/health
curl.exe http://localhost:3000/health
```

- [ ] FastAPI responde ok (envelope con `success:true` o `{"status":"ok"}`)
- [ ] Nest responde ok

---

## 5. Probar el flujo auth **por API** (sin frontend)

Esto aísla el backend: si funciona aquí, un fallo posterior está en el
frontend. Repite contra **ambos** backends cambiando el puerto
(`3000` = Nest, `8000` = FastAPI).

### 5.1 Registro

```powershell
curl.exe -X POST http://localhost:3000/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"Test\",\"email\":\"test@demo.dev\",\"password\":\"password123\"}'
```

- [ ] Responde `201` con `data.accessToken`, `data.refreshToken`, `data.user`

### 5.2 Login

```powershell
curl.exe -X POST http://localhost:3000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@demo.dev\",\"password\":\"password123\"}'
```

- [ ] Responde `200` con tokens. **Copia el `accessToken`.**

### 5.3 Ruta protegida `/users/me`

```powershell
curl.exe http://localhost:3000/api/v1/users/me `
  -H "Authorization: Bearer PEGA_AQUI_EL_ACCESS_TOKEN"
```

- [ ] Con token válido → `200` + tus datos (id, email, name, role)
- [ ] Sin token / token inválido → `401 Unauthorized`

### 5.4 Refresh y Logout

```powershell
# refresh (usa el refreshToken del login)
curl.exe -X POST http://localhost:3000/api/v1/auth/refresh `
  -H "Content-Type: application/json" `
  -d '{\"refreshToken\":\"PEGA_REFRESH_TOKEN\"}'

# logout
curl.exe -X POST http://localhost:3000/api/v1/auth/logout `
  -H "Content-Type: application/json" `
  -d '{\"refreshToken\":\"PEGA_REFRESH_TOKEN\"}'
```

- [ ] Refresh devuelve nuevos tokens
- [ ] Logout devuelve `success:true` e invalida el refresh token

### 5.5 Verificar que los stubs responden (opcional)

```powershell
curl.exe http://localhost:3000/api/v1/projects/health
```

- [ ] Responde `501` con `"Not implemented (stub)"` → confirma que el módulo
      está cableado pero sin lógica (comportamiento esperado)

> 💡 Alternativa cómoda para FastAPI: abre **http://localhost:8000/docs**
> (Swagger UI) y ejecuta los endpoints desde el navegador.

---

## 6. Arrancar el Frontend

```powershell
cd Frontend
npm run dev
```

- [ ] Nuxt arranca en `http://localhost:3001` (⚠️ 3001, no 3000 — 3000 es Nest)
- [ ] Si el log dice `Using alternative port 3000`, el 3001 está ocupado: Nuxt
      pisa a Nest y todo `/api/v1/*` responde 404 de Nitro. Libera el 3001 y reinicia.

---

## 7. Verificar el estado de los backends desde la UI

Abre: **http://localhost:3001/api-status**

- [ ] Muestra Nest y FastAPI como **online**
- [ ] Si alguno sale offline → ese backend no está arriba o CORS bloquea

> ⚠️ **Nota CORS:** los `.env` de los backends traen
> `CORS_ORIGINS=...localhost:5173` pero el frontend corre en **3001**.
> Si `/api-status` o el login fallan por CORS, añade `http://localhost:3001`
> a `CORS_ORIGINS` en el `.env` del backend y reinícialo.

---

## 8. Probar el flujo completo en el navegador

Abre: **http://localhost:3001/login**

1. Arriba verás el toggle **Backend: NestJS | FastAPI**. Empieza con NestJS.
2. Pulsa "¿No tienes cuenta? Regístrate".
3. Rellena nombre / email / password (mín. 8 caracteres) y envía.
   - [ ] Toast "Autenticado vía NEST"
   - [ ] Redirige a **/account** y muestra tu perfil
4. Pulsa **Cerrar sesión** → vuelve a `/login`.
5. Ahora prueba **login** con el admin del seed:
   `admin@portfolio.dev` / `admin12345`.
   - [ ] Entra y `/account` muestra rol `ADMIN`
6. **Repite con el toggle en FastAPI** (registra un usuario nuevo ahí; la BD
   es independiente de la de Nest).
   - [ ] Toast "Autenticado vía FASTAPI", `/account` funciona igual

### Verificar el guard de ruta protegida

- En una ventana **sin sesión** (o tras logout), entra directo a
  `http://localhost:3001/account`.
  - [ ] Te redirige a `/login?redirect=/account` (lo hace
        `Frontend/middleware/auth.ts`)

### Verificar persistencia de sesión

- Tras loguearte, **recarga** la página `/account`.
  - [ ] Sigues autenticado (tokens viven en cookies `access_token` /
        `refresh_token`)

---

## 9. (Opcional) Exponer el login en el navbar

Si quieres un botón visible en vez de entrar por URL, edita
`Frontend/components/layout/Navbar.vue`. En el array `nav` (línea ~138)
añade un `NuxtLink` a `/login`, o mejor un bloque condicional:

- Si `useAuthStore().isAuthenticated` → mostrar "Mi cuenta" (`/account`) +
  botón "Cerrar sesión".
- Si no → mostrar "Iniciar sesión" (`/login`).

No es necesario para que el sistema funcione; es solo UX.

---

## 10. Typecheck / tests (calidad)

```powershell
# Frontend
cd Frontend; npx nuxi typecheck; cd ..

# Nest
cd nest-backend; npm test; npm run test:e2e; cd ..   # e2e necesita Postgres

# FastAPI
cd fastapi-backend
$env:JWT_SECRET="test-secret"; .venv/Scripts/python.exe -m pytest -q; cd ..
```

- [ ] Typecheck frontend sin errores
- [ ] Tests unit Nest verdes
- [ ] Tests FastAPI verdes

---

## Resumen del veredicto

Si marcaste todo:

- ✅ **Auth + User** funcionan de punta a punta en **ambos** backends y el
  frontend los consume indistintamente (toggle Nest ⇄ FastAPI).
- ✅ Rutas protegidas, guard de navegación y persistencia por cookies OK.
- ⏳ **project / chat / contact / notification** siguen como *stub* — es lo
  esperado en esta fase (vertical slice). Ahí está el trabajo pendiente.

##  chestlist

---

### Estado de features (actualizado 2026-07-16)

**Módulos ML (FastAPI + Scikit-learn) — `src/module/ml/`**

- ✅ **Detección de Fraude en Wallets (Seguridad Web3)** — COMPLETO.
  - `POST /ml/fraud/wallet` con **IsolationForest** (sklearn) sobre features de la
    dirección (longitud, entropía, ratio de dígitos, repetición, formato válido).
  - Frontend: `BlockchainSection` analiza la wallet al escribirla, muestra badge de
    riesgo (Confiable/Revisión/Bloqueada + %) y **deshabilita el agente IA** si la
    wallet es sospechosa (bot/spam/artificial). Verificado en vivo (:8000, CORS OK).
  - Nota: se usó Isolation Forest (no XGBoost) por ser no-supervisado e ideal para
    detección de anomalías sin dataset etiquetado real.

- ✅ **Clasificación de Mensajes de Contacto** — COMPLETO (con persistencia).
  - `POST /ml/contact/classify` con **TF-IDF + LogisticRegression** (clasificador
    clásico ligero; NO DistilBERT por peso). Categorías: `job` / `freelance` / `spam`
    + prioridad (high/medium/low) + confianza. Dataset semilla bilingüe (~15/clase).
  - **Persistido**: al recibir un contacto, NestJS llama a FastAPI, guarda
    `category` + `priority` (columnas nuevas en `contact_submissions`, migración
    `add_contact_classification`) y **notifica por prioridad** (spam no avisa al
    dueño; job/freelance con tag de prioridad en el asunto).
  - Admin: `/admin/contact` muestra badge de categoría + prioridad por mensaje.
  - Frontend: además clasifica al enviar y muestra la categoría en un toast.

**n8n — PARCIAL (solo receptor)**

- ⚠️ Implementado como **receptor de webhooks**: `POST /webhook/:provider` (Nest y
  FastAPI) con validación **HMAC**. Es el endpoint que n8n *llamaría*.
- ❌ NO hay flujos n8n configurados ni instancia n8n corriendo (eso vive DENTRO de
  n8n, fuera de este repo) ni disparo saliente hacia n8n. No hay UI de n8n.
- Para "completarlo" end-to-end: levantar n8n, crear el workflow
  (formulario → BD → WhatsApp → CRM) y apuntarlo a este webhook con el secreto HMAC.

**Otros** (ya NO son stub): project (CRUD + imagen Cloudinary), chat (Ollama SSE),
contact, notification, blog (DB CRUD), blockchain agent — implementados.
