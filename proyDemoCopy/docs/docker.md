# Guía de Docker para PROYDEMO

Esta guía detalla paso a paso cómo configurar, levantar y verificar la infraestructura de contenedores para el proyecto.

## 1. Prerrequisitos
* Tener **Docker Desktop** instalado y abierto.
* Tener **pnpm** o **npm** instalado para correr las aplicaciones localmente.

---

## 2. Configuración de Variables de Entorno (.env)

Es muy importante que los datos de la base de datos en Docker coincidan con lo que esperan tus aplicaciones. 

Crea un archivo llamado `.env` en la **raíz del proyecto** (`C:\Users\angui\Documents\proyDemo\.env`) con el siguiente contenido:

```env
DATABASE_USER=postgres
DATABASE_PASSWORD=123456789
DATABASE_NAME=academy
```

Esto asegurará que cuando levantes Docker, se cree la base de datos `academy` con la contraseña `123456789`.

---

## 3. Dónde estar en la terminal
Para ejecutar los comandos de Docker, **SIEMPRE** debes estar en la **raíz del proyecto**:
`C:\Users\angui\Documents\proyDemo`

> **Nota:** No necesitas entrar a las carpetas `apps/backend`, `apps/ai-service` o `Frontend` para los comandos de Docker. El archivo `docker-compose.dev.yml` está en la raíz.

---

## 4. Paso a Paso: Levantar la Infraestructura

### Paso 1: Levantar servicios de base de datos y herramientas
Desde la raíz del proyecto, ejecuta:
```bash
docker compose -f docker-compose.dev.yml up -d
```
*   `-f docker-compose.dev.yml`: Especifica el archivo de configuración.
*   `up`: Levanta los contenedores.
*   `-d`: Modo "detached" (corre en segundo plano).

### Paso 2: Verificar que los contenedores estén corriendo
Ejecuta:
```bash
docker ps
```
Deberías ver 4 contenedores en la lista:
1.  `languageProject_postgres`
2.  `languageProject_redis`
3.  `languageProject_pgadmin`
4.  `languageProject_mailhog`

---

## 5. Cómo verificar la Base de Datos (PostgreSQL)

### Opción A: Usando pgAdmin (Interfaz Web)
1.  Abre tu navegador en: [http://localhost:5050](http://localhost:5050)
2.  **Login:**
    *   **Email:** `admin@proydemo.local`
    *   **Contraseña:** `admin`
3.  **Conectar al servidor:**
    *   Clic derecho en "Servers" -> "Register" -> "Server..."
    *   **General:** Nombre: `ProyDemo DB`
    *   **Connection:**
        *   Host: `postgres` (nombre del servicio en Docker)
        *   Port: `5432`
        *   Username: `postgres`
        *   Password: `123456789`
        *   Maintenance database: `academy`

### Opción B: Logs de Docker
Si quieres ver si hubo errores al iniciar la BD:
```bash
docker compose -f docker-compose.dev.yml logs -f postgres
```

---

## 6. Otros Servicios de Utilidad

*   **Mailhog (Atrapa correos):** [http://localhost:8025](http://localhost:8025)
*   **Redis:** Verificación rápida:
    ```bash
    docker exec -it languageProject_redis redis-cli ping
    ```
*   **MinIO (almacenamiento S3):** API en [http://localhost:9900](http://localhost:9900) · consola en [http://localhost:9901](http://localhost:9901). El servicio `minio-init` crea el bucket privado `aula-idiomas` (variable `S3_BUCKET`) en cada `docker compose up` y termina.

### 6.1 Almacenamiento de archivos (Sprint 6.7)

Los materiales de los cursos, el audio de pronunciación y los reportes exportados usan el mismo almacén, que se elige con `STORAGE_PROVIDER`. Cambiar de modo es cambiar variables en `apps/backend/.env`; el código no cambia.

| Modo | `STORAGE_PROVIDER` | Dónde quedan los archivos | Cómo se descargan |
|------|--------------------|---------------------------|-------------------|
| Disco | `local` (por defecto) | `UPLOADS_DIR/<módulo>/` | El backend los envía con Range 206 |
| MinIO (desarrollo) | `s3` | Bucket `S3_BUCKET` en MinIO, prefijo por módulo | 302 a una URL firmada de corta duración |
| Cloudflare R2 (producción) | `s3` | Bucket de R2, prefijo por módulo | 302 a una URL firmada de corta duración |

Prefijos: `course-materials/`, `pronunciation-audio/` y `reports/`. Los objetos son privados (sin ACL); el navegador solo entra con una URL firmada de `S3_SIGNED_URL_TTL` segundos (900 por defecto) y pide el rango del video directamente al bucket.

| Variable | MinIO local | Cloudflare R2 |
|----------|-------------|---------------|
| `STORAGE_PROVIDER` | `s3` | `s3` |
| `S3_ENDPOINT` | `http://localhost:9900` (dentro de Docker: `http://minio:9000`) | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_PUBLIC_ENDPOINT` | `http://localhost:9900` solo si el backend corre en Docker | Vacía |
| `S3_REGION` | `us-east-1` | `auto` |
| `S3_BUCKET` | `aula-idiomas` | Nombre del bucket de R2 |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Token de API de R2 |
| `S3_FORCE_PATH_STYLE` | `true` | `false` |
| `MAX_UPLOAD_MB` | `500` | `500` |
| `S3_SIGNED_URL_TTL` | `900` | `900` |

Las variables se validan con Zod al arrancar: si falta una o tiene un formato inválido, el backend no arranca y el mensaje nombra la variable sin mostrar su valor. Las credenciales van solo en `.env`, que no se sube al repositorio.

**Migrar los archivos que ya existen** (desde `apps/backend`, con las variables S3 configuradas):

```bash
pnpm storage:migrate --dry-run           # muestra qué subiría, sin escribir nada
pnpm storage:migrate                     # sube los archivos de UPLOADS_DIR; repetirlo no duplica
pnpm storage:migrate --legacy-buckets    # además copia los buckets antiguos de MinIO (un bucket por módulo)
```

**Cloudflare R2 en producción** (pasos en el panel de Cloudflare):

1. R2 → *Create bucket* (por ejemplo `aula-idiomas-prod`). No actives el acceso público ni `r2.dev`: las URL firmadas solo funcionan en el endpoint S3 de la cuenta.
2. R2 → *Manage R2 API Tokens* → *Create API token* con permiso **Object Read & Write**, limitado a ese bucket. Copia el *Access Key ID* y el *Secret Access Key* al gestor de secretos del hosting, nunca al repositorio.
3. Bucket → *Settings* → *CORS policy*. Hace falta para el lector de PDF, que pide el archivo con `fetch`; el video y la imagen no la necesitan:
   ```json
   [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["Range"], "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"], "MaxAgeSeconds": 3600 }]
   ```
   `*` es necesario porque, tras la redirección del backend, el navegador envía `Origin: null`. El acceso real lo controla la firma de cada URL.
4. Configura `STORAGE_PROVIDER=s3`, `S3_ENDPOINT` con el ID de tu cuenta, `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=false` y el bucket. Ejecuta `pnpm storage:migrate --dry-run` y después `pnpm storage:migrate`.

---

## 7. Siguientes Pasos: Conectar las Aplicaciones

Las aplicaciones corren **fuera** de Docker para facilitar el desarrollo, pero se conectan a la BD que está **dentro**.

### NestJS (Backend)
1.  Terminal: `cd apps/backend`
2.  `pnpm install`
3.  `pnpm dev`

### FastAPI (AI Service)
1.  Terminal: `cd apps/ai-service`
2.  `.venv\Scripts\activate`
3.  `pip install -r requirements.txt`
4.  `uvicorn src.main:app --reload`

### Next.js (Frontend)
1.  Terminal: `cd apps/frontend-next`
2.  `pnpm install`
3.  `pnpm dev`

---

## 8. Comandos de Mantenimiento

*   **Detener:** `docker compose -f docker-compose.dev.yml stop`
*   **Borrar contenedores:** `docker compose -f docker-compose.dev.yml down`
*   **Limpieza total (borra datos):** `docker compose -f docker-compose.dev.yml down -v`


////////////////////////////
Estoy presentando los siguientes errores  al crear un examen  que son los siguientes:
no esta generando la cantidad de preguntas que se le dice 
” y le voy a generar otras 3 o 4 o la cantidad que sea me genera el siguiente error  con el motor Mistral Nemo
Todos los providers AI fallaron. Último error: desconocido. Verifica Ollama y modelos instalados.
vuelvo dale clic al boton Generar y añadir y si me genera las preguntas entonces esta generando estos problemas a veces  y el input de cantidad no borra bien los números queda pegado el numero 1 y aveces sale esto de en el mensaje como cache Generadas 1 preguntas con qwen · caché. Debería salir un valor genérico 
al generar las preguntas en las opciones en la primera opción esta colocando la respuesta y en la respuesta esta colocando la opción como respuesta más no el contenido o texto de la respuesta correcta y como respuestas de opciones nunca una respuesta debe decir “opción A” y solo me esta generando preguntas de opciones multiples debería a ver un select que indique si las preguntas a generar son de que tipo 
Que la opción Publicar inmediatamente que no este activa por defecto  
/////////////////////////////////////////////////////////////////////////
en todas las graficas y listar las tablas de todos los roles debe rederizar por periodos que sea asi
listar todos los datos por 2 meses, 3 meses, 6 meses, 12 meses agregue un filtro por sección
//////////////////////////////////////////////////////////
la tabla de Leaderboard debe solo estar para el docente esa es información personal de los estudiantes 
///////////////////////////////////////////////////////////
de acuerdo a todas las correcciones realizadas el dia de hoy y ayer por favor actualices las pruebas unitarias,integrales, funcionales y todas las pruebas solo de lo que se corrigio y regaleme la lista de los que corregio.