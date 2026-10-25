"""
Genera Auth_y_Docker.docx con:
- Tutorial OAuth (Google + Microsoft) paso a paso
- Setup Docker para BD y servicios
- Validación de funcionamiento

Requisitos: pip install python-docx
Uso: python scripts/generate-auth-docker-doc.py
Salida: ./Auth_y_Docker.docx
"""
from docx import Document
from docx.shared import Pt, RGBColor, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


# ============ helpers ============
def add_heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    return h


def add_paragraph(doc, text, bold=False, italic=False, size=11):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    return p


def add_code_block(doc, code, language="bash"):
    """Bloque de código con fondo gris y fuente monospace."""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.3)
    run = p.add_run(code)
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    # Fondo gris claro
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), "F2F2F2")
    pPr.append(shd)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(text, style="List Bullet")
    return p


def add_numbered(doc, text):
    p = doc.add_paragraph(text, style="List Number")
    return p


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Light Grid Accent 1"
    # Header
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        for p in hdr_cells[i].paragraphs:
            for r in p.runs:
                r.bold = True
    # Body
    for r, row in enumerate(rows, start=1):
        for c, val in enumerate(row):
            table.rows[r].cells[c].text = str(val)
    return table


def add_callout(doc, label, text, color="FFF3CD"):
    """Llamado de atención (warning/info/tip)."""
    table = doc.add_table(rows=1, cols=1)
    cell = table.rows[0].cells[0]
    cell.text = ""
    p = cell.paragraphs[0]
    run = p.add_run(f"{label}: ")
    run.bold = True
    p.add_run(text)
    # Fondo
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
    tcPr.append(shd)
    return table


# ============ documento ============
doc = Document()

# Estilos globales
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)

# === Portada ===
title = doc.add_heading("Autenticación OAuth y Docker — ProyDemo", level=0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

subtitle = doc.add_paragraph()
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = subtitle.add_run("Guía de configuración Google OAuth, Microsoft Entra ID, Docker Compose y validación end-to-end")
run.italic = True
run.font.size = Pt(12)

doc.add_paragraph()
meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = meta.add_run("Stack: NestJS · Next.js 16 · PostgreSQL · Redis · Auth.js v5 · TypeORM · Docker Compose")
run.font.size = Pt(10)
run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

doc.add_page_break()

# === Índice ===
add_heading(doc, "Contenido", level=1)
toc_items = [
    "1. Introducción",
    "2. Credenciales Google OAuth",
    "3. Credenciales Microsoft Entra ID",
    "4. Variables de entorno (.env)",
    "5. Setup Docker — Base de datos y servicios",
    "6. Validación del funcionamiento",
    "7. Troubleshooting",
    "8. Anexos",
]
for item in toc_items:
    add_bullet(doc, item)

doc.add_page_break()

# ===================== 1. INTRODUCCIÓN =====================
add_heading(doc, "1. Introducción", level=1)
add_paragraph(
    doc,
    "Este documento describe el proceso completo para configurar autenticación OAuth con Google y Microsoft, "
    "levantar el stack Docker de desarrollo (PostgreSQL, Redis, pgAdmin, MailHog) y validar que todo funciona "
    "end-to-end en el proyecto ProyDemo."
)

add_heading(doc, "1.1 Componentes involucrados", level=2)
add_table(
    doc,
    ["Componente", "Rol", "Puerto"],
    [
        ["Frontend Next.js", "UI + Auth.js v5 + bridge OAuth", "9000"],
        ["Backend NestJS", "API REST + JWT propio + verificación id_token", "4000"],
        ["PostgreSQL", "Base de datos principal (TypeORM)", "5432"],
        ["Redis", "Cache + Bull queues", "6379"],
        ["pgAdmin", "UI web administración Postgres", "5050"],
        ["MailHog", "SMTP fake + UI emails", "1025 / 8025"],
        ["Google OAuth", "Provider OIDC (id_token)", "—"],
        ["Microsoft Entra ID", "Provider OIDC (id_token)", "—"],
    ],
)

add_heading(doc, "1.2 Flujo OAuth end-to-end", level=2)
flow_steps = [
    "Usuario hace click en botón “Google” o “Microsoft” en /login",
    "Server Action de Next.js dispara signIn() de Auth.js v5",
    "Auth.js redirige al provider (Google / Microsoft) con consent screen",
    "Provider devuelve a /api/auth/callback/<provider> con un code",
    "Auth.js intercambia code → id_token y lo guarda en sesión propia",
    "Auth.js redirige a /api/auth/oauth/bridge",
    "Bridge llama POST /auth/oauth de NestJS con el id_token",
    "NestJS verifica id_token contra JWKS del provider, find-or-create user, emite par JWT propio",
    "Bridge setea cookies httpOnly (neuroedu_access, neuroedu_refresh) y cierra Auth.js",
    "Redirect a /dashboard. proxy.ts permite acceso (cookie presente).",
]
for s in flow_steps:
    add_numbered(doc, s)

doc.add_page_break()

# ===================== 2. GOOGLE =====================
add_heading(doc, "2. Credenciales Google OAuth", level=1)
add_paragraph(
    doc,
    "Google OAuth 2.0 / OIDC es gratuito ilimitado para login. No requiere tarjeta de crédito."
)

add_heading(doc, "2.1 Acceso a Google Cloud Console", level=2)
add_bullet(doc, "URL: https://console.cloud.google.com/")
add_bullet(doc, "Login con tu cuenta personal de Google")
add_bullet(doc, "Acepta términos si es la primera vez")

add_heading(doc, "2.2 Crear proyecto", level=2)
add_numbered(doc, "En la barra superior, click en el selector de proyecto (al lado de “Google Cloud”)")
add_numbered(doc, "Click en “NEW PROJECT” / “Nuevo proyecto”")
add_numbered(doc, "Nombre del proyecto: proydemo-dev")
add_numbered(doc, "Click “CREATE” y espera ~30 segundos")
add_numbered(doc, "Selecciona el proyecto recién creado en el selector")

add_heading(doc, "2.3 Configurar OAuth Consent Screen (obligatorio)", level=2)
add_bullet(doc, "URL directa: https://console.cloud.google.com/apis/credentials/consent")
add_numbered(doc, "User Type: External → CREATE")
add_numbered(doc, "App name: ProyDemo")
add_numbered(doc, "User support email: tu email")
add_numbered(doc, "Developer contact email: tu email")
add_numbered(doc, "SAVE AND CONTINUE")
add_numbered(doc, "Scopes: deja default → SAVE AND CONTINUE")
add_numbered(doc, "Test users: añade tu propio email → SAVE AND CONTINUE")
add_numbered(doc, "BACK TO DASHBOARD")

add_heading(doc, "2.4 Crear OAuth Client ID", level=2)
add_bullet(doc, "URL directa: https://console.cloud.google.com/apis/credentials")
add_numbered(doc, "Click “+ CREATE CREDENTIALS” → “OAuth client ID”")
add_numbered(doc, "Application type: Web application")
add_numbered(doc, "Name: proydemo-web-dev")

add_paragraph(doc, "Authorized JavaScript origins:", bold=True)
add_code_block(doc, "http://localhost:9000")

add_paragraph(doc, "Authorized redirect URIs:", bold=True)
add_code_block(doc, "http://localhost:9000/api/auth/callback/google")

add_numbered(doc, "Click “CREATE”")

add_heading(doc, "2.5 Copiar credenciales", level=2)
add_paragraph(
    doc,
    "Tras crear el cliente, Google muestra un modal con:"
)
add_bullet(doc, "Client ID  →  variable GOOGLE_CLIENT_ID")
add_bullet(doc, "Client secret  →  variable GOOGLE_CLIENT_SECRET")

add_callout(
    doc,
    "Importante",
    "Las credenciales se pueden volver a consultar en cualquier momento desde la lista de Credentials. No hay que copiarlas inmediatamente bajo riesgo de perderlas.",
    color="D1ECF1",
)

doc.add_page_break()

# ===================== 3. MICROSOFT =====================
add_heading(doc, "3. Credenciales Microsoft Entra ID", level=1)
add_paragraph(
    doc,
    "Microsoft Entra ID ofrece un tier gratuito que incluye 50,000 usuarios activos por mes "
    "y autenticación ilimitada. Suficiente para desarrollo y la mayoría de apps en producción "
    "pequeñas/medianas."
)

add_heading(doc, "3.1 Acceso a Azure Portal", level=2)
add_bullet(doc, "URL: https://portal.azure.com/")
add_bullet(doc, "Login con cuenta Microsoft (personal o corporativa)")
add_bullet(doc, "Si no tienes cuenta: https://signup.live.com/")
add_bullet(doc, "Acepta términos Azure la primera vez (no requiere tarjeta para tier free de Entra)")

add_heading(doc, "3.2 Entrar a App registrations", level=2)
add_bullet(doc, "Busca “Microsoft Entra ID” en la barra superior")
add_bullet(doc, "Menú izquierdo → App registrations")
add_bullet(doc, "URL directa: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade")

add_heading(doc, "3.3 Registrar nueva aplicación", level=2)
add_numbered(doc, "Click en “+ New registration”")
add_numbered(doc, "Name: proydemo-dev")
add_numbered(
    doc,
    "Supported account types: “Accounts in any organizational directory and personal Microsoft accounts”",
)
add_paragraph(doc, "Redirect URI:", bold=True)
add_bullet(doc, "Platform: Web")
add_bullet(doc, "URL:")
add_code_block(doc, "http://localhost:9000/api/auth/callback/microsoft-entra-id")
add_numbered(doc, "Click “Register”")

add_heading(doc, "3.4 Copiar IDs de la app", level=2)
add_paragraph(doc, "En la pantalla Overview de la app:")
add_bullet(doc, "Application (client) ID  →  variable MICROSOFT_CLIENT_ID")
add_bullet(
    doc,
    "Directory (tenant) ID  →  ignora si usas “common”. Cópialo si vas a usar el tenant específico (MICROSOFT_TENANT_ID).",
)

add_heading(doc, "3.5 Crear Client Secret", level=2)
add_numbered(doc, "Menú izquierdo de la app: Certificates & secrets")
add_numbered(doc, "Tab “Client secrets” → click “+ New client secret”")
add_numbered(doc, "Description: proydemo-dev-secret")
add_numbered(doc, "Expires: 24 months (recomendado)")
add_numbered(doc, "Click “Add”")

add_callout(
    doc,
    "Crítico",
    "Copia el campo Value (NO “Secret ID”) inmediatamente. El valor solo se muestra una vez. Si lo pierdes, debes generar un secret nuevo.",
    color="F8D7DA",
)

add_paragraph(doc, "Resultado:")
add_bullet(doc, "Value del secret  →  variable MICROSOFT_CLIENT_SECRET")

add_heading(doc, "3.6 Permisos (opcional)", level=2)
add_paragraph(
    doc,
    "Por defecto la app tiene User.Read en Microsoft Graph, suficiente para login OIDC. "
    "Para añadir scopes adicionales como email o profile explícitos:"
)
add_numbered(doc, "Menú izquierdo: API permissions")
add_numbered(doc, "+ Add a permission → Microsoft Graph → Delegated")
add_numbered(doc, "Busca: openid, email, profile, offline_access → Add")
add_numbered(doc, "(Opcional) Grant admin consent")

doc.add_page_break()

# ===================== 4. ENV VARS =====================
add_heading(doc, "4. Variables de entorno (.env)", level=1)

add_heading(doc, "4.1 Generar AUTH_SECRET", level=2)
add_paragraph(doc, "Auth.js v5 requiere un secret para firmar cookies internas. Generar con:")

add_paragraph(doc, "PowerShell:", bold=True)
add_code_block(
    doc,
    '[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))',
)

add_paragraph(doc, "Git Bash / WSL:", bold=True)
add_code_block(doc, "openssl rand -base64 32")

add_paragraph(doc, "Online (si no tienes herramientas locales):", bold=True)
add_bullet(doc, "https://generate-secret.vercel.app/32")

add_heading(doc, "4.2 apps/frontend-next/.env.local", level=2)
add_code_block(
    doc,
    "# ===== Frontend env =====\n"
    "BACKEND_URL=http://localhost:4000\n"
    "API_PREFIX=api/v1\n\n"
    "ACCESS_TOKEN_COOKIE=neuroedu_access\n"
    "REFRESH_TOKEN_COOKIE=neuroedu_refresh\n\n"
    "NEXT_PUBLIC_APP_NAME=NeuroEdu IA\n"
    "NEXT_PUBLIC_APP_URL=http://localhost:9000\n\n"
    "# ===== Auth.js v5 =====\n"
    "AUTH_SECRET=<openssl rand -base64 32>\n"
    "AUTH_URL=http://localhost:9000\n\n"
    "# ===== Google OAuth =====\n"
    "GOOGLE_CLIENT_ID=123456789-abc...xyz.apps.googleusercontent.com\n"
    "GOOGLE_CLIENT_SECRET=GOCSPX-abcdef...\n\n"
    "# ===== Microsoft Entra ID =====\n"
    "MICROSOFT_CLIENT_ID=abc12345-de67-89ab-cdef-1234567890ab\n"
    "MICROSOFT_CLIENT_SECRET=Abc~XYZ123...\n"
    "MICROSOFT_TENANT_ID=common\n",
)

add_heading(doc, "4.3 apps/backend/.env", level=2)
add_paragraph(
    doc,
    "El backend solo necesita los CLIENT_ID (no los secrets) para validar la audience del id_token "
    "que llega desde el frontend.",
)
add_code_block(
    doc,
    "# ===== Server =====\n"
    "NODE_ENV=development\n"
    "PORT=4000\n"
    "API_PREFIX=api/v1\n\n"
    "# ===== Database =====\n"
    "DATABASE_HOST=localhost\n"
    "DATABASE_PORT=5432\n"
    "DATABASE_USER=postgres\n"
    "DATABASE_PASSWORD=postgres\n"
    "DATABASE_NAME=proydemo\n"
    "DATABASE_SYNCHRONIZE=true\n\n"
    "# ===== Redis =====\n"
    "REDIS_HOST=localhost\n"
    "REDIS_PORT=6379\n\n"
    "# ===== JWT =====\n"
    "JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars\n"
    "JWT_ACCESS_EXPIRES_IN=15m\n"
    "JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars\n"
    "JWT_REFRESH_EXPIRES_IN=7d\n\n"
    "# ===== OAuth verification =====\n"
    "GOOGLE_CLIENT_ID=<mismo de Google Console>\n"
    "MICROSOFT_CLIENT_ID=<mismo de Azure>\n"
    "MICROSOFT_TENANT_ID=common\n\n"
    "# ===== CORS =====\n"
    "CORS_ORIGINS=http://localhost:9000\n",
)

doc.add_page_break()

# ===================== 5. DOCKER =====================
add_heading(doc, "5. Setup Docker — Base de datos y servicios", level=1)

add_heading(doc, "5.1 Servicios incluidos", level=2)
add_table(
    doc,
    ["Servicio", "Imagen", "Puerto host", "Para qué"],
    [
        ["postgres", "postgres:16-alpine", "5432", "Base de datos principal (TypeORM)"],
        ["redis", "redis:7-alpine", "6379", "Cache + Bull queues (notificaciones, jobs)"],
        ["pgadmin", "dpage/pgadmin4", "5050", "UI web administración Postgres"],
        ["mailhog", "mailhog/mailhog", "1025 / 8025", "SMTP fake + UI emails dev"],
    ],
)

add_paragraph(
    doc,
    "Las apps (NestJS, Next.js, FastAPI) corren native con pnpm dev / uvicorn para mantener "
    "hot-reload instantáneo. Docker solo gestiona la infraestructura.",
    italic=True,
)

add_heading(doc, "5.2 Archivos del stack", level=2)
add_bullet(doc, "docker-compose.dev.yml — definición del stack")
add_bullet(doc, "docker/postgres/init/01_extensions.sql — extensiones uuid-ossp, pgcrypto, pg_trgm")

add_heading(doc, "5.3 Pre-requisitos", level=2)
add_bullet(doc, "Docker Desktop instalado y corriendo")
add_bullet(doc, "Windows: WSL 2 habilitado")
add_bullet(doc, "Verificar instalación:")
add_code_block(doc, "docker --version\ndocker compose version")

add_heading(doc, "5.4 Levantar el stack", level=2)
add_code_block(
    doc,
    "# Desde la raíz del proyecto\n"
    "cd C:\\Users\\angui\\Documents\\proyDemo\n\n"
    "# Levantar todos los servicios en background\n"
    "docker compose -f docker-compose.dev.yml up -d\n\n"
    "# Ver estado\n"
    "docker compose -f docker-compose.dev.yml ps\n\n"
    "# Ver logs en tiempo real\n"
    "docker compose -f docker-compose.dev.yml logs -f\n\n"
    "# Detener (sin borrar datos)\n"
    "docker compose -f docker-compose.dev.yml down\n\n"
    "# Detener + borrar volúmenes (CUIDADO: borra la base de datos)\n"
    "docker compose -f docker-compose.dev.yml down -v\n",
)

add_callout(
    doc,
    "Tip",
    "La primera vez tarda ~2 minutos en descargar las imágenes. Después arranca en ~10 segundos.",
    color="D4EDDA",
)

add_heading(doc, "5.5 Persistencia de datos", level=2)
add_paragraph(doc, "El stack usa volúmenes nombrados de Docker:")
add_bullet(doc, "pgdata — datos PostgreSQL (sobreviven a down)")
add_bullet(doc, "redisdata — append-only Redis")
add_bullet(doc, "pgadmindata — configuración pgAdmin")
add_paragraph(
    doc,
    "Para borrar todo y empezar limpio: docker compose down -v",
)

doc.add_page_break()

# ===================== 6. VALIDACIÓN =====================
add_heading(doc, "6. Validación del funcionamiento", level=1)

add_heading(doc, "6.1 Validar PostgreSQL", level=2)
add_paragraph(doc, "Verificar healthcheck:", bold=True)
add_code_block(doc, "docker compose -f docker-compose.dev.yml ps")
add_paragraph(doc, "Debe mostrar STATUS healthy en languageProject_postgres.")

add_paragraph(doc, "Conectarse al psql interno:", bold=True)
add_code_block(
    doc,
    "docker exec -it languageProject_postgres psql -U postgres -d proydemo\n\n"
    "# Dentro de psql:\n"
    "\\dt                  # listar tablas\n"
    "\\dx                  # verificar extensiones (uuid-ossp, pgcrypto, pg_trgm)\n"
    "SELECT uuid_generate_v4();   # debe devolver un UUID\n"
    "\\q                   # salir",
)

add_paragraph(doc, "Conectarse desde host (psql nativo o DBeaver):", bold=True)
add_code_block(
    doc,
    "Host: localhost\n"
    "Port: 5432\n"
    "User: postgres\n"
    "Password: postgres\n"
    "Database: proydemo",
)

add_heading(doc, "6.2 Validar pgAdmin", level=2)
add_numbered(doc, "Abrir http://localhost:5050")
add_numbered(doc, "Login: admin@proydemo.local / admin")
add_numbered(doc, "Click derecho en “Servers” → Register → Server")
add_numbered(doc, "Tab General → Name: proydemo-local")
add_numbered(doc, "Tab Connection:")
add_bullet(doc, "Host: postgres  (nombre del servicio, NO localhost)")
add_bullet(doc, "Port: 5432")
add_bullet(doc, "Username: postgres")
add_bullet(doc, "Password: postgres")
add_numbered(doc, "Save. Debes ver las tablas tras navegar en el árbol.")

add_heading(doc, "6.3 Validar Redis", level=2)
add_code_block(
    doc,
    "docker exec -it languageProject_redis redis-cli\n\n"
    "# Dentro de redis-cli:\n"
    "PING               # debe devolver PONG\n"
    "SET test \"hello\"\n"
    "GET test           # debe devolver \"hello\"\n"
    "DEL test\n"
    "EXIT",
)

add_heading(doc, "6.4 Validar MailHog", level=2)
add_numbered(doc, "Abrir http://localhost:8025")
add_numbered(doc, "Debe cargar la UI vacía (inbox sin mensajes)")
add_numbered(doc, "Probar envío desde terminal:")
add_code_block(
    doc,
    "# PowerShell — envío SMTP de prueba\n"
    "Send-MailMessage -To 'test@proydemo.local' -From 'app@proydemo.local' `\n"
    "  -Subject 'Test MailHog' -Body 'OK' -SmtpServer 'localhost' -Port 1025",
)
add_numbered(doc, "Refrescar http://localhost:8025 → debe aparecer el email")

add_heading(doc, "6.5 Validar backend NestJS contra Docker", level=2)
add_paragraph(doc, "Con el stack Docker corriendo, arrancar NestJS:")
add_code_block(
    doc,
    "cd C:\\Users\\angui\\Documents\\proyDemo\\apps\\backend\n"
    "pnpm start:dev",
)
add_paragraph(doc, "Logs esperados:", bold=True)
add_code_block(
    doc,
    "[Nest] LOG [NestFactory] Starting Nest application...\n"
    "[Nest] LOG [TypeOrmModule] TypeOrmModule dependencies initialized\n"
    "[Nest] LOG [InstanceLoader] AuthModule dependencies initialized\n"
    "[Nest] LOG [NestApplication] Nest application successfully started",
)
add_paragraph(doc, "Si falla con ECONNREFUSED → Postgres no está corriendo o puerto no expuesto.")

add_paragraph(doc, "Test rápido del endpoint OAuth:", bold=True)
add_code_block(
    doc,
    "# PowerShell\n"
    "Invoke-RestMethod -Method POST `\n"
    "  -Uri http://localhost:4000/api/v1/auth/oauth `\n"
    "  -ContentType 'application/json' `\n"
    "  -Body '{\"provider\":\"google\",\"idToken\":\"invalid\"}'\n"
    "# Debe devolver 401 'id_token de Google inválido' (lo cual es correcto: el guard funciona)",
)

add_heading(doc, "6.6 Validar OAuth end-to-end", level=2)
add_numbered(doc, "Stack Docker corriendo (Postgres + Redis)")
add_numbered(doc, "Backend NestJS corriendo en :4000 (pnpm start:dev)")
add_numbered(doc, "Frontend Next.js corriendo en :9000 (pnpm dev)")
add_numbered(doc, "Credenciales Google + Microsoft pegadas en .env.local y .env")
add_numbered(doc, "Abrir http://localhost:9000/login")
add_numbered(doc, "Click en botón “Google”")
add_paragraph(doc, "Resultado esperado:", bold=True)
add_bullet(doc, "Redirige a accounts.google.com")
add_bullet(doc, "Consent screen pide permisos")
add_bullet(doc, "Tras aceptar, vuelve a localhost:9000")
add_bullet(doc, "Pasa por /api/auth/oauth/bridge (rápido, casi invisible)")
add_bullet(doc, "Termina en /dashboard logueado")
add_bullet(doc, "F12 → Application → Cookies → debe existir neuroedu_access (httpOnly)")
add_bullet(doc, "F12 → Application → Cookies → NO debe existir cookie de Auth.js (se borró tras bridge)")

add_paragraph(doc, "Verificar en DB:")
add_code_block(
    doc,
    "docker exec -it languageProject_postgres psql -U postgres -d proydemo -c `\n"
    "  \"SELECT email, role, is_email_verified FROM users ORDER BY created_at DESC LIMIT 5;\"",
)
add_paragraph(doc, "Debe aparecer tu email con is_email_verified=true.")

doc.add_page_break()

# ===================== 7. TROUBLESHOOTING =====================
add_heading(doc, "7. Troubleshooting", level=1)

add_heading(doc, "7.1 Errores comunes OAuth", level=2)
add_table(
    doc,
    ["Error", "Causa", "Solución"],
    [
        [
            "redirect_uri_mismatch",
            "Redirect URI registrada en Google/Azure NO coincide con /api/auth/callback/<provider>",
            "Verificar que la URL en la consola sea exactamente http://localhost:9000/api/auth/callback/google o microsoft-entra-id",
        ],
        [
            "invalid_client",
            "CLIENT_ID o CLIENT_SECRET mal copiados",
            "Re-copiar y reiniciar dev server (.env solo se carga al boot)",
        ],
        [
            "AUTH_SECRET missing",
            "Auth.js v5 no encuentra el secret",
            "Generar uno con openssl y reiniciar Next.js",
        ],
        [
            "missing_id_token en bridge",
            "Auth.js no guardó el id_token o expiró antes del bridge",
            "Revisar callback jwt() en auth-config.ts. session.maxAge mínimo 600s",
        ],
        [
            "exchange_failed en bridge",
            "Backend NestJS rechazó el id_token",
            "Logs backend: 'id_token inválido' = audience no coincide. Verificar GOOGLE_CLIENT_ID en backend .env",
        ],
        [
            "CORS error",
            "Backend NestJS no permite origen del frontend",
            "Backend .env: CORS_ORIGINS=http://localhost:9000",
        ],
    ],
)

add_heading(doc, "7.2 Errores comunes Docker", level=2)
add_table(
    doc,
    ["Error", "Causa", "Solución"],
    [
        [
            "port is already allocated",
            "Otro proceso (otra app o Postgres nativo) usa el puerto",
            "Detener el proceso o cambiar puerto en docker-compose.dev.yml (ej. 5433:5432)",
        ],
        [
            "service unhealthy",
            "Postgres aún arrancando o init scripts fallaron",
            "docker compose logs postgres — revisar errores SQL",
        ],
        [
            "no space left on device",
            "Volúmenes Docker llenando disco",
            "docker system prune -a --volumes (CUIDADO: borra todo lo no usado)",
        ],
        [
            "WSL 2 required",
            "Docker Desktop en Windows requiere WSL 2",
            "wsl --install desde PowerShell admin",
        ],
        [
            "ECONNREFUSED desde backend",
            "Backend usa localhost pero contenedor solo escucha en bridge interno",
            "Verificar 'ports: 5432:5432' en compose. Backend usa DATABASE_HOST=localhost",
        ],
    ],
)

add_heading(doc, "7.3 Comandos de diagnóstico útiles", level=2)
add_code_block(
    doc,
    "# Ver salud de todos los servicios\n"
    "docker compose -f docker-compose.dev.yml ps\n\n"
    "# Logs de un servicio específico\n"
    "docker compose -f docker-compose.dev.yml logs postgres --tail 50\n\n"
    "# Reiniciar un solo servicio\n"
    "docker compose -f docker-compose.dev.yml restart redis\n\n"
    "# Entrar al contenedor por shell\n"
    "docker exec -it languageProject_postgres bash\n\n"
    "# Ver uso de recursos\n"
    "docker stats\n\n"
    "# Recrear desde cero (borra todo)\n"
    "docker compose -f docker-compose.dev.yml down -v\n"
    "docker compose -f docker-compose.dev.yml up -d",
)

doc.add_page_break()

# ===================== 8. ANEXOS =====================
add_heading(doc, "8. Anexos", level=1)

add_heading(doc, "8.1 URLs de referencia", level=2)
add_table(
    doc,
    ["Recurso", "URL"],
    [
        ["Google Cloud Console", "https://console.cloud.google.com/"],
        ["Google OAuth Consent", "https://console.cloud.google.com/apis/credentials/consent"],
        ["Google Credentials", "https://console.cloud.google.com/apis/credentials"],
        ["Azure Portal", "https://portal.azure.com/"],
        ["Microsoft App registrations", "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"],
        ["Auth.js v5 docs", "https://authjs.dev/getting-started"],
        ["NestJS docs", "https://docs.nestjs.com/"],
        ["Docker Desktop", "https://www.docker.com/products/docker-desktop/"],
        ["Generate secret online", "https://generate-secret.vercel.app/32"],
    ],
)

add_heading(doc, "8.2 Costos", level=2)
add_table(
    doc,
    ["Servicio", "Costo dev", "Costo prod"],
    [
        ["Google OAuth (login)", "$0", "$0 ilimitado"],
        ["Microsoft Entra ID", "$0", "$0 hasta 50K MAU"],
        ["Auth.js v5", "$0 (MIT)", "$0 (self-hosted)"],
        ["PostgreSQL (Docker)", "$0", "Según hosting elegido"],
        ["Redis (Docker)", "$0", "Según hosting elegido"],
        ["Total stack auth", "$0", "$0 — pagas solo hosting"],
    ],
)

add_heading(doc, "8.3 Archivos creados/modificados en el proyecto", level=2)
add_paragraph(doc, "Backend (NestJS):", bold=True)
add_bullet(doc, "src/shared/config/oauth.config.ts (nuevo)")
add_bullet(doc, "src/modules/auth/domain/interfaces/oauth-verifier.interface.ts (nuevo)")
add_bullet(doc, "src/modules/auth/application/dtos/oauth-login.dto.ts (nuevo)")
add_bullet(doc, "src/modules/auth/application/use-cases/oauth-login.use-case.ts (nuevo)")
add_bullet(doc, "src/modules/auth/infrastructure/services/google-oauth.verifier.ts (nuevo)")
add_bullet(doc, "src/modules/auth/infrastructure/services/microsoft-oauth.verifier.ts (nuevo)")
add_bullet(doc, "src/modules/auth/infrastructure/services/oauth-verifier.registry.ts (nuevo)")
add_bullet(doc, "src/modules/auth/auth.module.ts (modificado)")
add_bullet(doc, "src/modules/auth/presentation/auth.controller.ts (modificado)")
add_bullet(doc, ".env.example (modificado)")

add_paragraph(doc, "Frontend (Next.js):", bold=True)
add_bullet(doc, "src/lib/auth-config.ts (nuevo)")
add_bullet(doc, "src/lib/auth-nextauth.ts (nuevo)")
add_bullet(doc, "src/types/next-auth.d.ts (nuevo)")
add_bullet(doc, "src/app/api/auth/[...nextauth]/route.ts (reemplazado)")
add_bullet(doc, "src/app/api/auth/oauth/bridge/route.ts (nuevo)")
add_bullet(doc, "src/app/(auth)/login/oauth-actions.ts (nuevo)")
add_bullet(doc, "src/components/auth/OAuthButtons.tsx (modificado)")
add_bullet(doc, ".env.local (modificado)")

add_paragraph(doc, "Docker:", bold=True)
add_bullet(doc, "docker-compose.dev.yml (nuevo)")
add_bullet(doc, "docker/postgres/init/01_extensions.sql (nuevo)")

add_heading(doc, "8.4 Próximos pasos sugeridos", level=2)
add_numbered(doc, "Registrar credenciales reales en Google + Azure")
add_numbered(doc, "Pegar credenciales en .env.local y backend .env")
add_numbered(doc, "Levantar Docker stack")
add_numbered(doc, "Arrancar backend y frontend")
add_numbered(doc, "Probar login Google y Microsoft end-to-end")
add_numbered(doc, "Validar que neuroedu_access cookie aparece tras OAuth exitoso")
add_numbered(doc, "Configurar entorno producción: URI prod en Google/Azure, AUTH_URL=https://...")

# === Cierre ===
doc.add_paragraph()
closing = doc.add_paragraph()
closing.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = closing.add_run("— Fin del documento —")
run.italic = True
run.font.color.rgb = RGBColor(0x77, 0x77, 0x77)

# === Guardar ===
output_path = r"C:\Users\angui\Documents\proyDemo\Auth_y_Docker.docx"
doc.save(output_path)
print(f"Documento generado: {output_path}")
