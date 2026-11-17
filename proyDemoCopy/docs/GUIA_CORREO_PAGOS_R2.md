# Guía de configuración: correo (Gmail), Google, pasarela de pagos (Stripe) y Cloudflare R2

Fecha: 2026-11-16. Todo el código ya está implementado; aquí solo hay pasos de configuración que debes hacer tú con tus cuentas. **Nunca subas al repositorio los archivos `.env` / `.env.local` con claves reales.**

---

## 0. Antes de empezar: error 408 en `/api/auth/login`

**Causa encontrada:** PostgreSQL corre dentro de Docker (puerto `5433`) y Docker Desktop estaba congelado (`docker ps` no respondía). El puerto aceptaba la conexión pero la consulta nunca volvía, así que el `TimeoutInterceptor` de NestJS cortaba a los 30 s → **408 Request Timeout**. No era un fallo del código del login (también pasaba con un correo inexistente).

1. Cierra Docker Desktop por completo (icono de la bandeja → *Quit Docker Desktop*). Si no responde: Administrador de tareas → finalizar `Docker Desktop` y `com.docker.backend`.
2. En PowerShell como administrador: `wsl --shutdown`.
3. Abre Docker Desktop y espera a que diga *Engine running*.
4. `docker compose -f docker-compose.dev.yml up -d` (desde la raíz del proyecto).
5. Reinicia el backend (`pnpm start:dev` en `apps/backend`).
6. Comprueba: `curl -X POST http://localhost:4000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"x@x.com\",\"password\":\"Xx123456\"}"` → debe responder **401** en menos de 1 s.

---

## 1. Correos reales con Gmail (registro, recuperación, enlace mágico y código 2FA)

Hoy `apps/backend/.env` no tiene `SMTP_HOST`, por eso los correos **solo se imprimen en el log** (`[MAIL:DEV]`). Para que lleguen al buzón:

1. Entra a <https://myaccount.google.com/security> con la cuenta Gmail que enviará los correos.
2. Activa la **Verificación en 2 pasos** de Google (es obligatoria para el paso siguiente).
3. Abre <https://myaccount.google.com/apppasswords>, crea una contraseña de aplicación con el nombre `Aula de Idiomas` y copia los 16 caracteres (sin espacios).
4. Agrega a `apps/backend/.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=tu_cuenta@gmail.com
   SMTP_PASS=xxxxxxxxxxxxxxxx
   SMTP_FROM="Aula de Idiomas <tu_cuenta@gmail.com>"
   FRONTEND_URL=http://localhost:7000
   ```
5. Verifica que Redis esté arriba (la cola de correo usa Bull): `docker ps` debe mostrar el contenedor de Redis.
6. Reinicia el backend. Ya no debe aparecer el aviso `SMTP_HOST no definido`.
7. Prueba: regístrate con un correo tuyo → llega «Verifica tu correo». Usa «¿Olvidaste tu contraseña?» → llega «Restablece tu contraseña».
8. Si un correo no llega: como ADMIN revisa la bandeja de salida (`GET /api/v1/notifications/email/outbox`); el campo `lastError` dice por qué falló (p. ej. `Invalid login` = contraseña de aplicación mal copiada).

Límite: Gmail permite ~500 correos/día. Para producción con más volumen, cambia solo las variables `SMTP_*` a un proveedor transaccional (Brevo, Resend, Amazon SES); el código no cambia.

---

## 2. Inicio de sesión con Google (Microsoft ya se retiró)

1. <https://console.cloud.google.com/> → crea o elige un proyecto.
2. *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo **Externo**, nombre de la app, correo de soporte; en *Usuarios de prueba* agrega tus correos mientras esté en modo prueba.
3. *Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web*:
   - Orígenes autorizados: `http://localhost:7000`
   - URI de redirección autorizados: `http://localhost:7000/api/auth/callback/google`
4. Copia el **ID de cliente** y el **secreto**.
5. **Importante:** Next.js no está leyendo tus variables: el archivo se llama `apps/frontend-next/.env - copia.local`. Renómbralo a **`.env.local`** y deja:
   ```env
   AUTH_SECRET=<genera uno con: npx auth secret>
   AUTH_URL=http://localhost:7000
   AUTH_GOOGLE_ID=<ID de cliente>
   AUTH_GOOGLE_SECRET=<secreto>
   ```
   Borra las líneas `AUTH_MICROSOFT_ENTRA_ID_*` (ya no se usan) y deja un solo `AUTH_SECRET` (hoy hay dos, uno vacío).
6. En `apps/backend/.env`: `GOOGLE_CLIENT_ID=<el mismo ID de cliente>` y borra `MICROSOFT_CLIENT_ID` y `MICROSOFT_TENANT_ID`.
7. Reinicia Next.js y backend → «Continuar con Google» en `/login`.
8. En producción: agrega el dominio real en orígenes y redirección y publica la pantalla de consentimiento.

---

## 3. Verificación en dos pasos (2FA) — ya implementada

No necesita configuración extra (usa el mismo correo del paso 1):

- El usuario la activa en **Mi perfil → Verificación en dos pasos**, confirmando con su contraseña actual.
- Al iniciar sesión con contraseña, después de validarla se envía un **código OTP de 6 dígitos** al correo (válido 10 min, un solo uso, máximo 5 intentos por código y 5 intentos por minuto por IP).
- El **enlace mágico** (`Entrar sin contraseña`) y la **recuperación de contraseña** siguen funcionando como antes.
- Al iniciar sesión con Google no se pide el código (Google ya aplica su propio segundo factor).

Base de datos: en desarrollo (`DATABASE_SYNCHRONIZE=true`) la columna y la tabla se crean solas. En producción ejecuta `pnpm migration:run` en `apps/backend` (migración `1791995000000-TwoFactorOtp`).

---

## 4. Pasarela de pagos (Stripe, modo prueba)

El módulo `payments` (órdenes, sesión de pago con idempotencia, webhook firmado, factura PDF, reembolsos del ADMIN) y el checkout de Angular ya están hechos. Sin claves, el sistema usa la **compra de demostración** sin cobro.

### 4.1 Cuenta y claves
1. Crea una cuenta en <https://dashboard.stripe.com/register> (no necesitas activar pagos reales para el modo prueba).
2. Asegúrate de estar en **modo de prueba** (interruptor *Test mode* / sandbox).
3. *Developers → API keys*: copia la **Publishable key** (`pk_test_…`).
4. Recomendado: *Create restricted key* con permisos **Write** en *Checkout Sessions* y *Refunds* → copia la `rk_test_…`. (Alternativa: la *Secret key* `sk_test_…`).

### 4.2 Webhook en local
1. Instala la CLI: `npm i -g @stripe/cli` (o `scoop install stripe`).
2. `stripe login`
3. Deja corriendo en una terminal:
   ```bash
   stripe listen --forward-to localhost:4000/api/v1/payments/webhook
   ```
   Copia el `whsec_…` que imprime.

### 4.3 Variables en `apps/backend/.env`
```env
STRIPE_SECRET_KEY=rk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:7000
```
Reinicia el backend. Si una clave tiene el formato equivocado, el backend no arranca y dice **qué variable** está mal (nunca su valor).

### 4.4 Prueba de punta a punta
1. Inicia sesión como estudiante, agrega un curso de pago al carrito y ve al checkout.
2. Tarjeta de prueba: `4242 4242 4242 4242`, fecha futura, CVC `123`. Rechazada: `4000 0000 0000 0002`. Con 3-D Secure: `4000 0027 6000 3184`.
3. En la terminal de `stripe listen` debe verse el evento con respuesta `200`.
4. La pantalla de confirmación muestra *Pagado*, el curso queda desbloqueado y la factura PDF se descarga desde «Mis pagos».
5. Como ADMIN prueba un reembolso desde el historial de pagos.

### 4.5 Producción
- En el Dashboard: *Developers → Webhooks → Add endpoint* `https://TU_DOMINIO/api/v1/payments/webhook` con los eventos `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`; copia su `whsec_…`.
- **Stripe no opera directamente con empresas constituidas en Colombia.** El código acepta solo claves de prueba a propósito. Para cobrar dinero real elige: (a) una entidad legal en un país soportado por Stripe, o (b) una pasarela local (Wompi, Mercado Pago, PayU, ePayco) implementando un nuevo adaptador de `PaymentGatewayPort` (`apps/backend/src/modules/payments/domain/interfaces/payment-gateway.interface.ts`) sin tocar los casos de uso. Dime cuál eliges y lo implemento.

---

## 4-bis. Pasarela de pagos recomendada: Mercado Pago Colombia (modo prueba, gratis)

Mercado Pago es ahora la pasarela por defecto: si `MERCADOPAGO_ACCESS_TOKEN` está definido, el backend la usa en lugar de Stripe (`PAYMENT_PROVIDER` lo fuerza). Las credenciales de prueba son gratuitas, no cobran comisión, no mueven dinero real y no exigen empresa registrada.

### 4-bis.1 Credenciales de prueba
1. Entra a https://www.mercadopago.com.co/developers con tu cuenta personal → **Tus integraciones → Crear aplicación** (producto: *Checkout Pro*, pagos en línea).
2. En la aplicación: **Credenciales de prueba** → copia el **Access Token** (`TEST-…`). La Public Key no hace falta: el pago se hace en la página de Mercado Pago.
3. (Opcional, recomendado por Mercado Pago) **Cuentas de prueba** → crea un usuario *comprador* de prueba para pagar con él.

### 4-bis.2 Variables en `apps/backend/.env`
```env
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxx
MERCADOPAGO_USD_COP_RATE=4000          # los cursos con precio en USD se cobran en pesos
# Opcional (webhook): solo con URL pública
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_NOTIFICATION_URL=
```
Reinicia el backend (`apps/backend` → `pnpm start:dev`).

### 4-bis.3 Prueba de punta a punta
1. Compra un curso de pago → **Pagar** → **Pagar con Mercado Pago**.
2. En la página de Mercado Pago usa la tarjeta de prueba **Visa 4013 5406 8274 6260**, CVV **123**, vencimiento **11/30**, titular **APRO** (aprobado). Con titular **OTHE** se rechaza.
3. Pulsa **Volver al sitio** → `/checkout/confirmacion/...` consulta el estado y desbloquea el curso. En local no necesitas webhook.

### 4-bis.4 Webhook (opcional en local, obligatorio en producción)
1. Expón el backend: `cloudflared tunnel --url http://localhost:4000` (gratis) → copia la URL `https://…trycloudflare.com`.
2. `MERCADOPAGO_NOTIFICATION_URL=https://…trycloudflare.com/api/v1/payments/webhook`.
3. En la aplicación de Mercado Pago: **Webhooks → Configurar notificaciones** → misma URL, evento **Pagos** → copia la **clave secreta** en `MERCADOPAGO_WEBHOOK_SECRET`.
4. El backend verifica la firma `x-signature` (HMAC-SHA256) y vuelve a consultar el pago en la API antes de desbloquear nada.

### 4-bis.5 Reembolsos
Se hacen desde el mismo panel de reembolsos de la plataforma (`POST /v1/payments/{id}/refunds` de Mercado Pago).

## 5. Cloudflare R2 (almacenamiento de archivos)

El adaptador S3 único ya sirve materiales, audio, reportes, certificados y música desde disco, MinIO o R2 solo cambiando variables.

### 5.1 Crear el bucket
1. <https://dash.cloudflare.com/> → **R2 Object Storage** → activa R2 (pide un medio de pago; el plan gratuito incluye 10 GB/mes y la salida de datos es gratis).
2. *Create bucket* → nombre `aula-idiomas` (minúsculas), ubicación *Automatic*. **No** actives el acceso público: el backend entrega URL firmadas de corta duración.
3. Copia tu **Account ID** (columna derecha del panel de R2).

### 5.2 Credenciales
1. *R2 → Manage R2 API Tokens → Create API token*.
2. Permiso **Object Read & Write**, limitado al bucket `aula-idiomas`.
3. Copia **Access Key ID** y **Secret Access Key** (el secreto se muestra una sola vez).

### 5.3 CORS del bucket (para el lector PDF y el video vía URL firmada)
*Bucket → Settings → CORS policy*:
```json
[
  {
    "AllowedOrigins": ["http://localhost:7000", "https://TU_DOMINIO"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 5.4 Variables en `apps/backend/.env`
```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=aula-idiomas
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
S3_SIGNED_URL_TTL=900
STORAGE_LOCAL_MIRROR=false
```
(`STORAGE_LOCAL_MIRROR=true` guarda además una copia en `uploads/`; útil mientras migras.)

### 5.5 Migrar los archivos existentes y probar
1. Reinicia el backend: con datos mal puestos no arranca y nombra la variable faltante.
2. Sube los archivos que ya están en `apps/backend/uploads`: `pnpm storage:migrate` (en `apps/backend`).
3. Abre un material de curso: la descarga responde `302` a una URL `…r2.cloudflarestorage.com…?X-Amz-Signature=…` y el video avanza/retrocede (peticiones `Range` → `206`).
4. En el panel de R2 → *Objects* deben verse las claves con prefijo por módulo.

### 5.6 Volver a disco local
`STORAGE_PROVIDER=local` y reiniciar. No hay que tocar código.

---

## Resumen de lo que cambió en el código (2026-11-16)

| Cambio | Archivos principales |
|---|---|
| Registro envía el correo de verificación (antes nadie lo enviaba) | `backend/.../auth/application/use-cases/register.use-case.ts` |
| 2FA con código OTP por correo (entidad, casos de uso, endpoints `POST /auth/2fa/verify`, `GET/PATCH /auth/2fa`, migración) | `login-otp.entity.ts`, `issue-login-otp.use-case.ts`, `two-factor.use-cases.ts`, `auth.controller.ts`, `1791995000000-TwoFactorOtp.ts` |
| Paso del código en el login y tarjeta 2FA en el perfil | `frontend-next/.../LoginForm.tsx`, `hooks/useAuth.ts`, `api/auth/2fa/verify/route.ts`, `profile/edit/TwoFactorCard.tsx` |
| Microsoft retirado (solo Google) | `oauth-verifier.registry.ts`, `oauth.config.ts`, `auth.config.ts`, `lib/auth-config.ts`, `oauth/bridge/route.ts` |
