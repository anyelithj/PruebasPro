# Pendiente: levantar Docker como **languageProject**

## ¿Qué cambió?

| Antes (se conserva, no se elimina) | Ahora |
|---|---|
| Grupo `proydemo` en Docker Desktop | Grupo **`languageproject`** |
| `neuro-backend`, `neuro-minio`, `proydemo_postgres`, `proydemo_redis`, `proydemo_mailhog`, `proydemo_pgadmin` | `languageProject_backend`, `languageProject_minio`, `languageProject_postgres`, `languageProject_redis`, `languageProject_mailhog`, `languageProject_pgadmin` |
| Base de datos `academy` / `proydemo` | Base de datos **`languageproject`** (nueva y vacía) |

Se mantienen los mismos servicios y puertos:

| Servicio | Imagen | Puerto |
|---|---|---|
| backend | `languageproject-backend` (se construye desde `apps/backend`) | 4000:4000 |
| minio | `minio/minio:latest` | 9900:9000 (consola 9901:9001) |
| redis | `redis:7-alpine` | 6379:6379 |
| postgres | `postgres:16-alpine` | 5432:5432 (y 5433:5432 para las apps de Windows) |
| mailhog | `mailhog/mailhog:latest` | 1025:1025 (web 8025:8025) |
| pgadmin | `dpage/pgadmin4:latest` | 5050:80 |

> **Importante:** las dos pilas (`proydemo` y `languageproject`) usan los **mismos puertos**, así que no pueden estar encendidas a la vez. Los contenedores `proydemo` solo se **detienen**, no se borran: se pueden volver a encender cuando quieras (ver el final de esta guía).
>
> Además, tu Windows tiene instalado **PostgreSQL 18** como servicio, y ocupa el puerto **5432**. Hay que detenerlo para que el Postgres de Docker pueda usar ese puerto. Es reversible.

Archivos que ya quedaron preparados, no tienes que tocarlos:
- `docker-compose.dev.yml`: pila `languageproject` con los 6 servicios.
- `apps/backend/Dockerfile` y `.dockerignore`: imagen del backend.
- `.env` (raíz): nombre de la base, usuario y contraseña (la misma que ya usaba tu backend).
- `apps/backend/.env` y `apps/ai-service/.env`: apuntan a `localhost:5432/languageproject`. Hay copias de respaldo con el sufijo `.bak-before-languageproject`.

---

## Paso a paso

Usa **PowerShell**. Copia cada bloque tal cual.

### 1. Abrir Docker Desktop
Ábrelo y espera a que abajo a la izquierda diga **Engine running**.

### 2. Detener (sin eliminar) los contenedores antiguos
```powershell
docker stop neuro-backend neuro-minio proydemo_postgres proydemo_redis proydemo_mailhog proydemo_pgadmin
```
Si alguno ya estaba detenido, Docker igual lo muestra; no pasa nada.

### 3. Detener el PostgreSQL de Windows (libera el puerto 5432)
Abre **PowerShell como administrador**: clic derecho sobre PowerShell → *Ejecutar como administrador*.
```powershell
Stop-Service postgresql-x64-18
```
Opcional, para que no vuelva a arrancar solo al encender el PC:
```powershell
Set-Service postgresql-x64-18 -StartupType Manual
```
> Para volver a usarlo más adelante: `Start-Service postgresql-x64-18`. Tu base `academy` sigue intacta ahí.

Cierra esa ventana de administrador y sigue en una PowerShell normal.

### 4. Comprobar que los puertos están libres
```powershell
Get-NetTCPConnection -LocalPort 4000,5432,6379,9900,1025,5050 -State Listen -ErrorAction SilentlyContinue
```
**No debe mostrar nada.** Si aparece algún puerto, algo sigue usándolo: repite los pasos 2 y 3, o cierra el `pnpm run start:dev` del backend si lo tienes abierto.

### 5. Ir a la carpeta del proyecto
```powershell
cd C:\Users\angui\Documents\proyectoBorrador\proyDemoCopy
```

### 6. Construir y levantar la pila nueva
```powershell
docker compose -f docker-compose.dev.yml up -d --build
```
La primera vez tarda unos minutos porque construye la imagen del backend.

### 7. Verificar los contenedores
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
Deben aparecer los 6 `languageProject_*`. `postgres`, `redis` y `minio` deben mostrar `(healthy)`. El `backend` puede tardar hasta 1 minuto en pasar a `(healthy)`.

En Docker Desktop verás el grupo **languageproject**. El grupo **proydemo** sigue ahí, detenido.

### 8. Ver que el backend arrancó bien
```powershell
docker compose -f docker-compose.dev.yml logs -f backend
```
Espera la línea `API listening on http://localhost:4000/api/v1`. Sal con **Ctrl + C**; el contenedor sigue funcionando.

Al arrancar, el backend crea automáticamente las tablas y estos datos iniciales:
- 42 cursos (7 idiomas × 6 niveles MCER).
- La fuente **"Contenido propio"**.
- Los temas de ejemplo de Inglés · A1 · Gramática.

### 9. Verificar la base de datos
```powershell
docker exec -it languageProject_postgres psql -U postgres -d languageproject -c "\dt"
```
Debe listar tablas como `users`, `courses`, `quizzes` y `curriculum_items`.

### 10. Arrancar ai-service y frontend (fuera de Docker)
El backend ya corre en Docker: **no ejecutes `pnpm run start:dev`** del backend, porque chocaría con el puerto 4000.

Terminal 1, ai-service:
```powershell
cd C:\Users\angui\Documents\proyectoBorrador\proyDemoCopy\apps\ai-service
.\.venv\Scripts\python.exe -m uvicorn src.main:app --port 8000 --reload
```

Terminal 2, frontend:
```powershell
cd C:\Users\angui\Documents\proyectoBorrador\proyDemoCopy\Frontend
pnpm dev
```

### 11. Direcciones útiles

| Qué | URL | Acceso |
|---|---|---|
| Aplicación | http://localhost:9000 | usuarios de la sección siguiente |
| API (Swagger) | http://localhost:4000/api/v1/docs | — |
| pgAdmin | http://localhost:5050 | `admin@languageproject.dev` / `admin` |
| MailHog | http://localhost:8025 | — |
| Consola MinIO | http://localhost:9901 | `minioadmin` / `minioadmin` |

Para conectar pgAdmin a la base: *Add New Server* → pestaña **Connection**:
- Host: `postgres` (es el nombre del servicio dentro de Docker; no uses `localhost`).
- Puerto: `5432`.
- Base de datos: `languageproject`.
- Usuario: `postgres`.
- Contraseña: la de `DATABASE_PASSWORD` en el `.env` de la raíz.

---

## Crear los datos nuevos: usuarios admin, docente y estudiante

La base `languageproject` empieza vacía. El proyecto ya trae un script que crea los tres usuarios.

### 1. Requisito
El backend en Docker debe haber arrancado al menos una vez (paso 8), porque es él quien crea la tabla `users`.

### 2. Ejecutar el script de usuarios
```powershell
cd C:\Users\angui\Documents\proyectoBorrador\proyDemoCopy\apps\backend
pnpm run seed:users
```
El script se conecta a `localhost:5432/languageproject` (el Postgres de Docker) usando `apps/backend/.env`. Al terminar muestra una línea por usuario.

### 3. Usuarios creados

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@neuroedu.ia` | `StrongP@ss123` |
| Docente | `docente@neuroedu.ia` | `StrongP@ss123` |
| Estudiante | `estudiante@neuroedu.ia` | `StrongP@ss123` |

> Estos correos son de prueba. Los usa la batería de tests del frontend, por eso se mantienen. El script se puede ejecutar varias veces: si el usuario ya existe, restablece su contraseña y su rol.

### 4. Comprobar que existen
```powershell
docker exec -it languageProject_postgres psql -U postgres -d languageproject -c "SELECT email, role, is_active FROM users;"
```

### 5. Entrar a la aplicación
1. Abre http://localhost:9000/login.
2. Entra con **admin@neuroedu.ia** / **StrongP@ss123**.
3. Menú **Contenido** → **+ Nuevo recurso** para empezar a cargar tu contenido curricular.
4. Con **docente@neuroedu.ia** puedes crear exámenes. Con **estudiante@neuroedu.ia**, resolverlos.

---

## Apagar o volver a la pila antigua

Apagar languageProject (conserva los datos):
```powershell
cd C:\Users\angui\Documents\proyectoBorrador\proyDemoCopy
docker compose -f docker-compose.dev.yml stop
```

Volver a encender la pila antigua `proydemo`:
```powershell
docker start proydemo_postgres proydemo_redis proydemo_mailhog proydemo_pgadmin neuro-minio neuro-backend
```

Volver a encender languageProject:
```powershell
docker compose -f docker-compose.dev.yml start
```

> No uses `docker compose ... down -v`: la opción `-v` **borra la base de datos**.

## Problemas comunes

| Síntoma | Solución |
|---|---|
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | PostgreSQL de Windows u otro contenedor sigue encendido → pasos 2 y 3. |
| El backend se reinicia en bucle | Revisa `docker compose -f docker-compose.dev.yml logs backend`. Lo habitual es que Postgres aún no estuviera listo; espera 1 minuto. |
| `seed:users` falla con `relation "users" does not exist` | El backend no ha arrancado todavía → paso 8. |
| `seed:users` falla con `password authentication failed` | La contraseña de `apps/backend/.env` y la del `.env` de la raíz deben ser la misma. |
| `no existe la base de datos «languageproject»` al usar `pnpm run start`, `seed:users` o ai-service | El PostgreSQL de Windows responde en `127.0.0.1:5432` antes que Docker. Ya está resuelto: `apps/backend/.env` y `apps/ai-service/.env` usan el puerto **5433** (publicado por el Postgres de Docker). Si vuelve a pasar, revisa que `DATABASE_PORT=5433`. |
| `pnpm run start` del backend falla con `EADDRINUSE :4000` | El backend ya corre en Docker. Para trabajar con el backend en Windows (recarga en caliente): `docker compose -f docker-compose.dev.yml stop backend` y después `pnpm run start:dev`. Para volver al de Docker: Ctrl+C y `docker compose -f docker-compose.dev.yml start backend`. |
////////////////////////////////////////////////////////
Qué encontré y cambié
- El grupo "proydemo" de Docker Desktop mezcla dos proyectos: neuro-backend y neuro-minio vienen de Downloads\mi-proyecto-neuro\proyDemo. Copié esos dos servicios a este proyecto sin modificar la carpeta original.
- Este repo no tenía Dockerfile para el backend; lo creé.
- El pgAdmin antiguo se caía porque rechaza correos terminados en .local. El nuevo acceso es admin@languageproject.dev / admin.
- Creé un .env en la raíz con el nombre de la base y la misma contraseña que ya usaba tu backend.
- Actualicé los .env del backend y de ai-service a la base languageproject. Dejé copias .bak-before-languageproject.

Usuarios: al final de la guía está el paso para crearlos con pnpm run seed:users, después de que el backend haya arrancado una vez. Quedan:
- Administrador: admin@neuroedu.ia
- Docente: docente@neuroedu.ia
- Estudiante: estudiante@neuroedu.ia

Los tres con la contraseña StrongP@ss123.

Las tres usan la contraseña StrongP@ss123:

┌────────────────────────┬─────────┐
│         Correo         │   Rol   │
├────────────────────────┼─────────┤
│ estudiante@neuroedu.ia │ USER    │
├────────────────────────┼─────────┤
│ docente@neuroedu.ia    │ TEACHER │
├────────────────────────┼─────────┤
│ admin@neuroedu.ia      │ ADMIN   │
└────────────────────────┴─────────┘
Si más adelante reinicias la base de datos, vuelve a ejecutar pnpm run seed:users.