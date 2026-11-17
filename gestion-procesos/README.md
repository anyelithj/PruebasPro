# Gestión de Procesos

React 19 + TypeScript + Firebase + Bootstrap/Sass + Redux Toolkit. Renderizado en el cliente (CSR), sin servidor propio.

## Primeros pasos con Firebase (en este orden)

Sin esto la aplicación abre, pero no puede leer ni guardar datos y **no verás los botones de crear, editar, ver detalle y eliminar, ni el historial ni los workflows**.

1. **Authentication → Método de acceso:** activa *Correo electrónico/contraseña* y *Google*.
2. **Firestore Database → Crear base de datos** (si aún no existe).
3. **Firestore Database → Reglas:** pega todo el contenido de `firestore.rules` y pulsa **Publicar**. (Por terminal: `firebase login` y luego `pnpm db:deploy --project ID-DE-TU-PROYECTO`.)
4. Crea el `.env` con las claves de tu app web (ver más abajo) y ejecuta `pnpm dev`.
5. **Regístrate con tu cuenta: el primer usuario queda como administrador** y ve todo el CRUD, el historial, los workflows y «Usuarios y roles». Los siguientes usuarios nacen como miembros.

Si algo falla al cargar tu perfil, la aplicación muestra una pantalla con la causa (por ejemplo `permission-denied`) y un botón «Reintentar». Si alguna lista no se puede leer, aparece un aviso rojo arriba con el motivo.

## Puesta en marcha

1. `pnpm install` (ver `DEPENDENCIAS.md`; requiere Node 22+).
2. Copia `.env.example` como `.env` y completa los datos de tu app web de Firebase.
3. En Firebase Console:
   - **Authentication → Método de acceso**: activa *Correo electrónico/contraseña* y *Google*.
   - **Firestore Database**: crea la base de datos.
   - Publica las reglas: `firebase deploy --only firestore:rules` (archivo `firestore.rules`).
4. `pnpm dev`

### Si la pantalla muestra «Falta configurar Firebase»

Significa que **Vite no está leyendo tus variables** (antes producía el error `auth/invalid-api-key` y la página en blanco). Ejecuta en la raíz del proyecto:

```bash
pnpm env:check
```

Te dice qué variable falta y por qué, sin mostrar tus claves. Las causas más comunes:

1. El archivo no se llama exactamente `.env` (por ejemplo `.env.txt`), o está en otra carpeta: debe estar junto a `package.json`.
2. Llenaste `.env.example` en vez de copiarlo a `.env`.
3. Los nombres no empiezan con `VITE_` (por ejemplo `FIREBASE_API_KEY`). También se aceptan los de Create React App (`REACT_APP_FIREBASE_API_KEY`).
4. Falta el valor después del `=`, o hay espacios alrededor. El formato es `NOMBRE=valor`.
5. No reiniciaste el servidor después de editar el archivo (`Ctrl + C` y `pnpm dev`).
6. **Con Docker:** el `.env` debe estar junto a `docker-compose.yml` y hay que volver a construir (`docker compose up --build -d`); sin `--build` se reutiliza la imagen anterior, que quedó sin claves. Para ver qué valores recibe Docker: `docker compose config`. Al construir, si las variables llegan vacías, la construcción se detiene con una explicación.

La propia pantalla muestra el modo y los **nombres** de las variables `VITE_` que Vite sí cargó.

## Primer administrador

El **primer usuario que se registra queda como administrador** automáticamente. Los siguientes nacen como miembros y el administrador les cambia el rol en **Usuarios y roles**. Si necesitas convertir a otra persona en administrador sin entrar a la aplicación: `pnpm db:setup --project ID --key clave.json --admin correo`.

## Docker

```bash
cp .env.example .env                       # completa los datos de Firebase
docker compose up --build -d               # producción (Nginx) → http://localhost:8080
docker compose --profile dev up dev        # desarrollo con recarga → http://localhost:5173
```

Nombres: proyecto `gestion-procesos`, imagen `gestion-procesos:latest` y contenedor `gestion-procesos` (en desarrollo: `gestion-procesos-dev`). Se ven con `docker ps`; para detenerlo, `docker compose down`.

Vite incrusta las variables `VITE_*` al compilar: si cambias el `.env`, vuelve a construir la imagen (`--build`).
Nota: los archivos Docker no se pudieron probar en el entorno donde se generó el proyecto (no tenía Docker).

## Módulos

| # | Módulo | Dónde |
|---|---|---|
| 1 | Procesos y solicitudes (crear, listar, ver, editar, eliminar) | `/app/procesos` |
| 2 | Tareas (crear, listar, ver, editar, eliminar) | `/app/tareas` |
| 3 | Workflows (crear, listar, ver, editar, eliminar) | `/app/workflows` |
| 4 | Tablero Kanban de procesos (por estado del workflow) y de tareas | `/app/kanban` |
| 5 | Estados, prioridades y responsables | formularios de procesos y tareas |
| 6 | Agenda: fechas de inicio y límite de procesos y tareas; vista mes y lista; agendar desde un día | `/app/calendario` |
| 7 | Indicadores de procesos y tareas según el flujo | `/app/dashboard` |
| 8 | Reportes descargables en **PDF, Excel, Word y CSV** | `/app/reportes` |
| 9 | Automatizaciones «cuando pase X, haz Y» | `/app/automatizaciones` |
| 10 | Notificaciones guardadas y alertas calculadas (vencidos y próximos a vencer) | campana y `/app/notificaciones` |
| 11 | Usuarios, roles y permisos (crear, listar, ver, editar, desactivar, eliminar) | `/app/usuarios` |
| 12 | Historial y seguimiento de cambios | detalle de cada elemento y `/app/historial` |
| 13 | Chat por canales, chat de cada proceso y traducción español ↔ inglés | `/app/chat` |
| 14 | Asistente: responde preguntas con tus datos | `/app/ia` |
| 15 | Clasificación y resumen de solicitudes | formulario y detalle de proceso |
| 16 | Búsqueda y filtros avanzados | `/app/procesos/buscar`, tareas, documentos |
| 17 | Archivos y documentos adjuntos | detalle de proceso/tarea y `/app/documentos` |
| 18 | Perfil y configuración (cargo, idioma del chat, avisos) | `/app/perfil` |
| 19 | Indicadores ligados al flujo: avance por estado, cumplimiento de fechas, días de cierre, estancados | `/app/dashboard` |

## Rutas y permisos

- **Públicas**: `/`, `/login`, `/registro`. `PublicRoute` redirige a `/app` si ya hay sesión.
- **Privadas**: todo `/app/*`. `PrivateRoute` exige sesión y una cuenta activa.
- **Protegidas**: algunas rutas exigen además un permiso (`ProtectedRoute`). La matriz rol → permisos está en `src/services/permissions.ts`.

| Rol | Puede |
|---|---|
| admin | Todo, incluido gestionar usuarios |
| manager | Todo menos gestionar usuarios |
| member | Crear/editar procesos y tareas, subir archivos, chat, indicadores, reportes, historial, ver workflows, asistente |
| viewer | Solo leer: indicadores, reportes, historial y workflows |

La interfaz oculta lo que el rol no permite y `firestore.rules` lo refuerza en el servidor (incluida la cuenta desactivada).

## Arquitectura

Arquitectura **en capas** (presentación → estado y casos de uso → dominio → infraestructura) con flujo de datos unidireccional. El detalle por carpeta está en `ESTRUCTURA_CARPETAS.md`.

- `redux/reducers`: un *slice* por colección (RTK + adaptador de entidades). `redux/actions`: operaciones que escriben en Firestore y registran el historial.
- `hooks/useDataSync`: una sola suscripción por colección (Observer), montada una vez en el área privada. Los demás hooks (`useProcesses`, `useTasks`…) solo leen del store.
- `services`: lógica pura y fácil de probar (permisos, workflow como máquina de estados, indicadores, filtros, alertas, reportes, asistente). Patrones usados solo donde aportan: Facade (`firestoreService`), Adapter (`toAuthUser`, backend de archivos), State (`workflow`), Strategy (acciones de automatización y exportadores), Chain of Responsibility (`assistant`).
- Componentes: contenedores (leen datos y coordinan) y presentacionales (solo pintan), por composición.

## Estilos: SMACSS + BEM

`src/styles/config.scss` es el punto de entrada y carga las capas de SMACSS en orden:

| Capa | Carpeta | Convención |
|---|---|---|
| Base | `base/` | Elementos HTML y variables de Bootstrap, sin clases |
| Layout | `layout/` | Prefijo `l-` (`l-shell`, `l-auth`, `l-stack`…) |
| Módulos | `modules/` y `Style*.scss` | BEM: `bloque__elemento--modificador` |
| Estado | `state/` | Prefijo `is-` (`is-current`, `is-overdue`…) |
| Tema | `theme/` | Paleta y medidas como variables CSS |

## Archivos adjuntos

Por defecto se guardan **en Firestore** (gratis, hasta ~600 KB por archivo). Para archivos más grandes usa `VITE_FILES_BACKEND=storage` (Cloud Storage; Firebase puede exigir el plan Blaze) y publica `storage.rules`.

## Límites que conviene conocer

- **Automatizaciones**: se ejecutan en el navegador de quien mueve la tarea o el proceso. No corren si nadie está conectado; para eso haría falta Cloud Functions.
- **Alertas de vencimiento**: se calculan al abrir la aplicación, no se envían por correo ni por notificación push.
- **Eliminar usuarios**: desde el navegador solo se puede borrar el perfil; la cuenta de Firebase Authentication requiere el SDK Admin. Si esa persona vuelve a entrar, se crea un perfil nuevo como miembro. Para bloquear el acceso de forma permanente usa **Desactivar**.
- **Traducción**: la primera vez descarga un modelo (decenas de MB) y queda en caché. Solo español ↔ inglés.
- **Asistente**: responde con reglas sobre tus datos; no es un modelo de lenguaje y no entiende preguntas fuera de su alcance.

## Base de datos (esquema y script de terminal)

El esquema está en `database/schema.json` (máquina) y `database/ESQUEMA_BASE_DE_DATOS.md` (lectura, con diagrama). Comandos:

```bash
pnpm db:check                                                        # valida el esquema y lo compara con firestore.rules
pnpm db:setup --project <id> --key <clave.json> --admin <correo>     # guarda _meta/schema y crea el primer administrador
pnpm db:deploy                                                       # publica firestore.rules e índices
```

## Código comentado

Los archivos centrales están comentados línea por línea en español y `GUIA_DEL_CODIGO.md` reúne el glosario de palabras reservadas (JavaScript, TypeScript, React, Redux Toolkit, Firebase), los patrones, los paradigmas y la arquitectura.

## CRUD y roles

Procesos, tareas, usuarios y workflows tienen listar, crear, ver detalle, editar y eliminar (rutas y permisos en `GUIA_DEL_CODIGO.md`, sección 3). **Una cuenta nueva es «miembro» y no puede eliminar ni gestionar usuarios**: crea tu administrador con `pnpm db:setup ... --admin`.

## Formularios reutilizables (crear, editar y ver detalle)

Cada entidad tiene **un solo formulario** que recibe `mode="create" | "edit" | "view"`:

| Entidad | Formulario | Lo usan |
|---|---|---|
| Proceso | `uploadProcess/ProcessForm` | `AddProcess`, `EditProcesses`, `DetailProcess` |
| Tarea | `tasks/TaskForm` | `AddTask`, `EditTask`, `TaskDetail` y «Agregar tarea» dentro de un proceso |
| Usuario | `admin/UserForm` | `AddUser`, `EditUser`, `UserDetail` |
| Workflow | `workflow/WorkflowForm` | `WorkflowEditor` (crear y editar) y `WorkflowDetail` |

Todos se apoyan en `accesories/FormShell` (estructura, errores y modo solo lectura con `<fieldset disabled>`) y en el hook `useFormSubmit` (estado de guardado y errores). Agregar un campo se hace una sola vez y aparece en los tres casos.

## Calidad y pruebas

- **Prettier** (`.prettierrc.json`) y **ESLint 9** (`eslint.config.js`, con reglas de hooks, TypeScript y accesibilidad `jsx-a11y`). `pnpm check` ejecuta tipos, lint, formato y pruebas.
- **Jest + Testing Library** (`pnpm test`): servicios, hook de envío, los cuatro formularios en sus tres modos, rutas protegidas, exportación a PDF/Excel/Word/CSV y una prueba de humo que renderiza todas las historias de Storybook. Los archivos de prueba viven junto al código, en carpetas `__tests__`.
- **Cypress** (`pnpm e2e`): recorre las pantallas públicas (inicio, login, registro) y comprueba que las rutas privadas redirigen al login. Usa `.env.e2e` con valores ficticios, así que **no necesita un proyecto de Firebase**. Los flujos con sesión iniciada (crear un proceso, mover una tarea…) requieren el Emulador de Firebase (necesita Java) y no están incluidos.
- **Storybook** (`pnpm storybook`): documenta los componentes reutilizables con sus variantes, una pestaña de accesibilidad y dos guías (arquitectura y estilos SMACSS + BEM). Las historias usan el store real con datos de ejemplo y nunca se conectan a Firebase.

## Scripts

`pnpm dev` · `pnpm build` · `pnpm preview` · `pnpm typecheck` · `pnpm lint` · `pnpm format` · `pnpm test` · `pnpm e2e` · `pnpm storybook` · `pnpm check`

## Despliegue en Firebase Hosting

`pnpm build` y `firebase deploy --only hosting`. `firebase.json` ya redirige todas las rutas a `index.html`.

## SEO

`<title>` y `<meta>` por página con el componente `Seo` (React 19 los mueve al `<head>`), `robots.txt`, `sitemap.xml` (cambia `tu-dominio.com`) y manifiesto. Al ser CSR, el SEO real aplica a la landing y a login/registro; las páginas privadas llevan `noindex`.
