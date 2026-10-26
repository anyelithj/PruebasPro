# ⚙️ Backend Express TypeScript — Guía de Creación desde Cero (Git Bash + pnpm)

> Proyecto: **ecommerce-express** · Basado en `01_EXPRESS_TS.md`, `ecommerce_matriz_trazabilidad_v34.xlsx` (hoja "⚙️ Express TS") y `ESPECIFICACION_TECNICA_UNIFICADA.md`.
> Solo se incluyen tecnologías presentes en esos documentos. No se agregaron librerías redundantes (una sola opción por función: p. ej. un solo cliente HTTP, un solo ORM SQL, un solo logger).
>
> **Política del proyecto (v35):** solo tecnologías **open source o gratuitas**. Cuando una librería del documento original era de pago, redundante u obsoleta se reemplazó por una alternativa libre o por una API nativa; cada cambio está marcado con 🔄 y justificado. Estado real de la implementación: ver la sección **6** al final.

---

## 0. Prerrequisitos (verificar en Git Bash)

```bash
node -v        # Node 20+ recomendado
pnpm -v        # si no está instalado: corepack enable pnpm
git --version
docker -v      # para PostgreSQL, MongoDB, Redis en docker-compose
```

---

## 1. Crear el proyecto desde cero

```bash
mkdir ecommerce-express && cd ecommerce-express
git init
pnpm init
pnpm add -D typescript ts-node-dev @types/node
pnpm exec tsc --init
```

---

## 2. Instalar dependencias (pnpm)

Agrupadas exactamente por lo que exige la matriz/documento. Cada tecnología aparece **una sola vez** aunque se use en varios módulos.

### 2.1 Núcleo del framework y tipado

```bash
pnpm add express dotenv cors helmet
pnpm add -D @types/express @types/cors typescript ts-node-dev
```

### 2.2 Validación (Zod, único validador — no se agrega Joi/Yup por ser redundante)

```bash
pnpm add zod
```

### 2.3 Base de datos — Prisma (PostgreSQL) + Mongoose (MongoDB) + Redis

```bash
pnpm add -D prisma
pnpm add @prisma/client mongoose ioredis
pnpm exec prisma init
```

### 2.4 Autenticación — JWT, bcrypt, Passport (JWT), OAuth2 y Web3 (SIWE)

```bash
pnpm add jsonwebtoken bcrypt passport passport-jwt
pnpm add -D @types/jsonwebtoken @types/bcrypt @types/passport @types/passport-jwt
```

> 🔄 **`auth0` eliminado:** Auth0 es un SaaS propietario (plan gratuito limitado). La autenticación es propia y open source: JWT + refresh token rotativo + bcrypt + 2FA por email.
> 🔄 **`passport-oauth2` eliminado:** next-auth (frontend) completa el flujo OAuth2 de Google/GitHub/Discord y el backend verifica el `access_token` llamando al endpoint de perfil de cada proveedor con `axios` (`module/auth/strategy/oauth.strategy.ts`). Una estrategia Passport por proveedor sería código duplicado.
> Web3 (Sign-In With Ethereum) usa `verifyMessage` de **ethers** (sección 2.10); no requiere paquete extra.

### 2.5 API — REST + GraphQL (Apollo Server) + WebSocket (Socket.io)

```bash
pnpm add @apollo/server graphql graphql-tag socket.io
```

### 2.6 Documentación de API (OpenAPI 3.0)

```bash
pnpm add swagger-ui-express
pnpm add -D @types/swagger-ui-express
```

> 🔄 **`swagger-jsdoc` no se usa:** el documento OpenAPI se **genera** recorriendo las rutas reales de Express (`src/config/swagger.config.ts`), así nunca se desactualiza respecto al código. UI en `http://localhost:4000/api/docs` (solo fuera de producción) y JSON en `/api/docs.json`.

### 2.7 IA local (LangChain + LangGraph + Ollama) — usada en módulos de chatbot/recomendación

```bash
pnpm add langchain @langchain/langgraph ollama
```

### 2.8 Integraciones de pagos, medios y PDF

```bash
pnpm add stripe cloudinary multer pdfkit
pnpm add -D @types/multer @types/pdfkit
```

> `pdfkit` (MIT) genera los PDF de factura electrónica y guías de envío (el documento ya lo pedía en `invoice/util/pdf.util.ts`).
> Stripe y Cloudinary son servicios **gratuitos para empezar** (Stripe no cobra mensualidad, solo comisión por transacción real; el modo test es gratis. Cloudinary tiene plan gratuito). Sus SDK son open source (MIT).
> 🔄 **Sharp no se instala:** Cloudinary ya transforma y optimiza las imágenes (`f_auto`, `q_auto` → WebP/AVIF); procesarlas también en el servidor sería trabajo duplicado.

### 2.9 Notificaciones y correo

```bash
pnpm add nodemailer
pnpm add -D @types/nodemailer
```

> `mailparser` se instalará en la **Fase 7** (módulo Email Parser); aún no se usa.
> 🔄 **Handlebars no se instala:** las plantillas de email son funciones puras de TypeScript con template literals (`email/util/template.util.ts`), tipadas y sin motor extra.
> Push: **Firebase Cloud Messaging** (gratuito) vía API HTTP v1 firmada con `jsonwebtoken` (sin SDK `firebase-admin`). Tiempo real: `socket.io`.

### 2.10 Web3 / Blockchain

```bash
pnpm add ethers
```

> 🔄 **`ipfs-http-client` eliminado:** está deprecado (reemplazado por Helia) y solo se distribuye como ESM, incompatible con el build CommonJS del proyecto. La metadata de los NFT se sube con la **API RPC de Kubo (IPFS)** usando `axios` (`POST /api/v0/add`), que ya está instalado.
> 🔄 **Solo `ethers` v6:** cubre firma/verificación SIWE, contratos ERC-721 (`safeMint`) y proveedores RPC. No se agrega `web3.js` (haría lo mismo). `wagmi` es una librería de **frontend** y no pertenece a este backend.

### 2.11 Infraestructura interna (logs, HTTP saliente; colas y MCP en fases posteriores)

```bash
pnpm add winston axios
# Fases 6-7 (aún no instalados): pnpm add bullmq @modelcontextprotocol/sdk
```

> 🔄 **`dayjs` no se instala:** la aritmética de fechas es mínima y se resuelve con `Date` nativo en funciones puras (`shared/util/date.util.ts`).
> Los jobs periódicos actuales (expirar checkouts/reservas, puntos vencidos) corren con `setInterval` en `server.ts`; migran a **BullMQ** (open source, usa el Redis existente) cuando se escale a varias réplicas.

> `axios` cubre las llamadas salientes a APIs externas sin SDK propio en Node: n8n, Chatwoot, Meta WhatsApp Business API, Instagram Graph API, Facebook Commerce API, TikTok Commerce API.

### 2.12 Azure — OPCIONAL, apagado por defecto, con respaldo gratuito

```bash
pnpm add @azure/identity @azure/keyvault-secrets @azure/communication-email @azure/monitor-opentelemetry
```

> Los SDK son open source (MIT) y se cargan con `import()` dinámico **solo** si `AZURE_ENABLED=true`. Con el valor por defecto (`false`) el proyecto usa únicamente alternativas gratuitas. Si Azure está activo pero falla, se vuelve a la alternativa automáticamente:
>
> | Servicio Azure | Variable(s) | Alternativa gratuita (por defecto y respaldo) | Código |
> |----------------|-------------|------------------------------------------------|--------|
> | Key Vault (secretos) | `AZURE_KEY_VAULT_URL` | Variables del `.env` | `src/config/azure.config.ts` (se ejecuta antes de validar la configuración) |
> | Application Insights | `APPLICATIONINSIGHTS_CONNECTION_STRING` | Logs estructurados de winston | `src/config/azure.config.ts` |
> | Communication Services Email | `AZURE_COMMUNICATION_CONNECTION_STRING`, `AZURE_EMAIL_SENDER` | Nodemailer + SMTP (Mailpit en desarrollo) | `module/email/provider/` (Strategy + failover con circuit breaker de 5 min) |
> | Database for PostgreSQL · Cache for Redis · Cosmos/Atlas | `DATABASE_URL`, `REDIS_URL`, `MONGO_URL` | Contenedores locales de Docker | Solo cambia la cadena de conexión |
>
> `src/server.ts` resuelve primero los secretos y la telemetría y luego importa `src/bootstrap.ts` (composition root). Pruebas en `test/unit/azure-fallback.spec.ts`.

### 2.13 Testing

```bash
pnpm add -D jest ts-jest @types/jest supertest @types/supertest
pnpm exec ts-jest config:init
```

---

## 3. Crear la estructura completa de carpetas y archivos

> Generado automáticamente a partir del árbol exacto de `01_EXPRESS_TS.md` (36 módulos, N-Layer Architecture). Ejecutar dentro de la carpeta padre que contiene `ecommerce-express/` (o ajustar rutas si ya estás dentro de ella, quitando el prefijo `ecommerce-express/`).

```bash
mkdir -p \
  "ecommerce-express/src" \
  "ecommerce-express/src/module" \
  "ecommerce-express/src/module/auth" \
  "ecommerce-express/src/module/auth/controller" \
  "ecommerce-express/src/module/auth/service" \
  "ecommerce-express/src/module/auth/repository" \
  "ecommerce-express/src/module/auth/model" \
  "ecommerce-express/src/module/auth/dto" \
  "ecommerce-express/src/module/auth/route" \
  "ecommerce-express/src/module/auth/schema" \
  "ecommerce-express/src/module/auth/types" \
  "ecommerce-express/src/module/auth/util" \
  "ecommerce-express/src/module/auth/guard" \
  "ecommerce-express/src/module/auth/strategy" \
  "ecommerce-express/src/module/auth/exception" \
  "ecommerce-express/src/module/user" \
  "ecommerce-express/src/module/user/controller" \
  "ecommerce-express/src/module/user/service" \
  "ecommerce-express/src/module/user/repository" \
  "ecommerce-express/src/module/user/model" \
  "ecommerce-express/src/module/user/dto" \
  "ecommerce-express/src/module/user/route" \
  "ecommerce-express/src/module/user/schema" \
  "ecommerce-express/src/module/user/types" \
  "ecommerce-express/src/module/user/exception" \
  "ecommerce-express/src/module/role" \
  "ecommerce-express/src/module/role/controller" \
  "ecommerce-express/src/module/role/service" \
  "ecommerce-express/src/module/role/repository" \
  "ecommerce-express/src/module/role/model" \
  "ecommerce-express/src/module/role/dto" \
  "ecommerce-express/src/module/role/route" \
  "ecommerce-express/src/module/role/schema" \
  "ecommerce-express/src/module/role/exception" \
  "ecommerce-express/src/module/permission" \
  "ecommerce-express/src/module/permission/controller" \
  "ecommerce-express/src/module/permission/service" \
  "ecommerce-express/src/module/permission/repository" \
  "ecommerce-express/src/module/permission/model" \
  "ecommerce-express/src/module/permission/dto" \
  "ecommerce-express/src/module/permission/route" \
  "ecommerce-express/src/module/permission/schema" \
  "ecommerce-express/src/module/permission/exception" \
  "ecommerce-express/src/module/product" \
  "ecommerce-express/src/module/product/controller" \
  "ecommerce-express/src/module/product/service" \
  "ecommerce-express/src/module/product/repository" \
  "ecommerce-express/src/module/product/model" \
  "ecommerce-express/src/module/product/dto" \
  "ecommerce-express/src/module/product/route" \
  "ecommerce-express/src/module/product/schema" \
  "ecommerce-express/src/module/product/types" \
  "ecommerce-express/src/module/product/exception" \
  "ecommerce-express/src/module/category" \
  "ecommerce-express/src/module/category/controller" \
  "ecommerce-express/src/module/category/service" \
  "ecommerce-express/src/module/category/repository" \
  "ecommerce-express/src/module/category/model" \
  "ecommerce-express/src/module/category/dto" \
  "ecommerce-express/src/module/category/route" \
  "ecommerce-express/src/module/category/schema" \
  "ecommerce-express/src/module/category/exception" \
  "ecommerce-express/src/module/brand" \
  "ecommerce-express/src/module/brand/controller" \
  "ecommerce-express/src/module/brand/service" \
  "ecommerce-express/src/module/brand/repository" \
  "ecommerce-express/src/module/brand/model" \
  "ecommerce-express/src/module/brand/dto" \
  "ecommerce-express/src/module/brand/route" \
  "ecommerce-express/src/module/brand/schema" \
  "ecommerce-express/src/module/brand/exception" \
  "ecommerce-express/src/module/collection" \
  "ecommerce-express/src/module/collection/controller" \
  "ecommerce-express/src/module/collection/service" \
  "ecommerce-express/src/module/collection/repository" \
  "ecommerce-express/src/module/collection/model" \
  "ecommerce-express/src/module/collection/dto" \
  "ecommerce-express/src/module/collection/route" \
  "ecommerce-express/src/module/collection/schema" \
  "ecommerce-express/src/module/collection/exception" \
  "ecommerce-express/src/module/cart" \
  "ecommerce-express/src/module/cart/controller" \
  "ecommerce-express/src/module/cart/service" \
  "ecommerce-express/src/module/cart/repository" \
  "ecommerce-express/src/module/cart/model" \
  "ecommerce-express/src/module/cart/dto" \
  "ecommerce-express/src/module/cart/route" \
  "ecommerce-express/src/module/cart/schema" \
  "ecommerce-express/src/module/cart/exception" \
  "ecommerce-express/src/module/search" \
  "ecommerce-express/src/module/search/controller" \
  "ecommerce-express/src/module/search/service" \
  "ecommerce-express/src/module/search/repository" \
  "ecommerce-express/src/module/search/model" \
  "ecommerce-express/src/module/search/dto" \
  "ecommerce-express/src/module/search/route" \
  "ecommerce-express/src/module/search/schema" \
  "ecommerce-express/src/module/search/exception" \
  "ecommerce-express/src/module/checkout" \
  "ecommerce-express/src/module/checkout/controller" \
  "ecommerce-express/src/module/checkout/service" \
  "ecommerce-express/src/module/checkout/repository" \
  "ecommerce-express/src/module/checkout/model" \
  "ecommerce-express/src/module/checkout/dto" \
  "ecommerce-express/src/module/checkout/route" \
  "ecommerce-express/src/module/checkout/schema" \
  "ecommerce-express/src/module/checkout/exception" \
  "ecommerce-express/src/module/order" \
  "ecommerce-express/src/module/order/controller" \
  "ecommerce-express/src/module/order/service" \
  "ecommerce-express/src/module/order/repository" \
  "ecommerce-express/src/module/order/model" \
  "ecommerce-express/src/module/order/dto" \
  "ecommerce-express/src/module/order/route" \
  "ecommerce-express/src/module/order/schema" \
  "ecommerce-express/src/module/order/event" \
  "ecommerce-express/src/module/order/exception" \
  "ecommerce-express/src/module/payment" \
  "ecommerce-express/src/module/payment/controller" \
  "ecommerce-express/src/module/payment/service" \
  "ecommerce-express/src/module/payment/repository" \
  "ecommerce-express/src/module/payment/model" \
  "ecommerce-express/src/module/payment/dto" \
  "ecommerce-express/src/module/payment/route" \
  "ecommerce-express/src/module/payment/schema" \
  "ecommerce-express/src/module/payment/util" \
  "ecommerce-express/src/module/payment/exception" \
  "ecommerce-express/src/module/shipping" \
  "ecommerce-express/src/module/shipping/controller" \
  "ecommerce-express/src/module/shipping/service" \
  "ecommerce-express/src/module/shipping/repository" \
  "ecommerce-express/src/module/shipping/model" \
  "ecommerce-express/src/module/shipping/dto" \
  "ecommerce-express/src/module/shipping/route" \
  "ecommerce-express/src/module/shipping/schema" \
  "ecommerce-express/src/module/shipping/exception" \
  "ecommerce-express/src/module/invoice" \
  "ecommerce-express/src/module/invoice/controller" \
  "ecommerce-express/src/module/invoice/service" \
  "ecommerce-express/src/module/invoice/repository" \
  "ecommerce-express/src/module/invoice/model" \
  "ecommerce-express/src/module/invoice/dto" \
  "ecommerce-express/src/module/invoice/route" \
  "ecommerce-express/src/module/invoice/schema" \
  "ecommerce-express/src/module/invoice/util" \
  "ecommerce-express/src/module/invoice/exception" \
  "ecommerce-express/src/module/refund" \
  "ecommerce-express/src/module/refund/controller" \
  "ecommerce-express/src/module/refund/service" \
  "ecommerce-express/src/module/refund/repository" \
  "ecommerce-express/src/module/refund/model" \
  "ecommerce-express/src/module/refund/dto" \
  "ecommerce-express/src/module/refund/route" \
  "ecommerce-express/src/module/refund/schema" \
  "ecommerce-express/src/module/refund/exception" \
  "ecommerce-express/src/module/coupon" \
  "ecommerce-express/src/module/coupon/controller" \
  "ecommerce-express/src/module/coupon/service" \
  "ecommerce-express/src/module/coupon/repository" \
  "ecommerce-express/src/module/coupon/model" \
  "ecommerce-express/src/module/coupon/dto" \
  "ecommerce-express/src/module/coupon/route" \
  "ecommerce-express/src/module/coupon/schema" \
  "ecommerce-express/src/module/coupon/exception" \
  "ecommerce-express/src/module/loyalty" \
  "ecommerce-express/src/module/loyalty/controller" \
  "ecommerce-express/src/module/loyalty/service" \
  "ecommerce-express/src/module/loyalty/repository" \
  "ecommerce-express/src/module/loyalty/model" \
  "ecommerce-express/src/module/loyalty/dto" \
  "ecommerce-express/src/module/loyalty/route" \
  "ecommerce-express/src/module/loyalty/schema" \
  "ecommerce-express/src/module/loyalty/util" \
  "ecommerce-express/src/module/loyalty/exception" \
  "ecommerce-express/src/module/review" \
  "ecommerce-express/src/module/review/controller" \
  "ecommerce-express/src/module/review/service" \
  "ecommerce-express/src/module/review/repository" \
  "ecommerce-express/src/module/review/model" \
  "ecommerce-express/src/module/review/dto" \
  "ecommerce-express/src/module/review/route" \
  "ecommerce-express/src/module/review/schema" \
  "ecommerce-express/src/module/review/exception" \
  "ecommerce-express/src/module/notification" \
  "ecommerce-express/src/module/notification/controller" \
  "ecommerce-express/src/module/notification/service" \
  "ecommerce-express/src/module/notification/repository" \
  "ecommerce-express/src/module/notification/model" \
  "ecommerce-express/src/module/notification/dto" \
  "ecommerce-express/src/module/notification/route" \
  "ecommerce-express/src/module/notification/schema" \
  "ecommerce-express/src/module/notification/event" \
  "ecommerce-express/src/module/notification/exception" \
  "ecommerce-express/src/module/social-commerce" \
  "ecommerce-express/src/module/social-commerce/controller" \
  "ecommerce-express/src/module/social-commerce/service" \
  "ecommerce-express/src/module/social-commerce/repository" \
  "ecommerce-express/src/module/social-commerce/model" \
  "ecommerce-express/src/module/social-commerce/dto" \
  "ecommerce-express/src/module/social-commerce/route" \
  "ecommerce-express/src/module/social-commerce/schema" \
  "ecommerce-express/src/module/social-commerce/exception" \
  "ecommerce-express/src/module/automation" \
  "ecommerce-express/src/module/automation/controller" \
  "ecommerce-express/src/module/automation/service" \
  "ecommerce-express/src/module/automation/repository" \
  "ecommerce-express/src/module/automation/model" \
  "ecommerce-express/src/module/automation/dto" \
  "ecommerce-express/src/module/automation/route" \
  "ecommerce-express/src/module/automation/schema" \
  "ecommerce-express/src/module/automation/exception" \
  "ecommerce-express/src/module/communication" \
  "ecommerce-express/src/module/communication/controller" \
  "ecommerce-express/src/module/communication/service" \
  "ecommerce-express/src/module/communication/repository" \
  "ecommerce-express/src/module/communication/model" \
  "ecommerce-express/src/module/communication/dto" \
  "ecommerce-express/src/module/communication/route" \
  "ecommerce-express/src/module/communication/schema" \
  "ecommerce-express/src/module/communication/event" \
  "ecommerce-express/src/module/communication/exception" \
  "ecommerce-express/src/module/analytics" \
  "ecommerce-express/src/module/analytics/controller" \
  "ecommerce-express/src/module/analytics/service" \
  "ecommerce-express/src/module/analytics/repository" \
  "ecommerce-express/src/module/analytics/model" \
  "ecommerce-express/src/module/analytics/dto" \
  "ecommerce-express/src/module/analytics/route" \
  "ecommerce-express/src/module/analytics/schema" \
  "ecommerce-express/src/module/analytics/event" \
  "ecommerce-express/src/module/analytics/exception" \
  "ecommerce-express/src/module/inventory" \
  "ecommerce-express/src/module/inventory/controller" \
  "ecommerce-express/src/module/inventory/service" \
  "ecommerce-express/src/module/inventory/repository" \
  "ecommerce-express/src/module/inventory/model" \
  "ecommerce-express/src/module/inventory/dto" \
  "ecommerce-express/src/module/inventory/route" \
  "ecommerce-express/src/module/inventory/schema" \
  "ecommerce-express/src/module/inventory/event" \
  "ecommerce-express/src/module/inventory/exception" \
  "ecommerce-express/src/module/supplier" \
  "ecommerce-express/src/module/supplier/controller" \
  "ecommerce-express/src/module/supplier/service" \
  "ecommerce-express/src/module/supplier/repository" \
  "ecommerce-express/src/module/supplier/model" \
  "ecommerce-express/src/module/supplier/dto" \
  "ecommerce-express/src/module/supplier/route" \
  "ecommerce-express/src/module/supplier/schema" \
  "ecommerce-express/src/module/supplier/exception" \
  "ecommerce-express/src/module/recommendation" \
  "ecommerce-express/src/module/recommendation/controller" \
  "ecommerce-express/src/module/recommendation/service" \
  "ecommerce-express/src/module/recommendation/repository" \
  "ecommerce-express/src/module/recommendation/model" \
  "ecommerce-express/src/module/recommendation/dto" \
  "ecommerce-express/src/module/recommendation/route" \
  "ecommerce-express/src/module/recommendation/schema" \
  "ecommerce-express/src/module/recommendation/ml" \
  "ecommerce-express/src/module/recommendation/exception" \
  "ecommerce-express/src/module/graph-analysis" \
  "ecommerce-express/src/module/graph-analysis/controller" \
  "ecommerce-express/src/module/graph-analysis/service" \
  "ecommerce-express/src/module/graph-analysis/repository" \
  "ecommerce-express/src/module/graph-analysis/model" \
  "ecommerce-express/src/module/graph-analysis/dto" \
  "ecommerce-express/src/module/graph-analysis/route" \
  "ecommerce-express/src/module/graph-analysis/schema" \
  "ecommerce-express/src/module/graph-analysis/ml" \
  "ecommerce-express/src/module/graph-analysis/exception" \
  "ecommerce-express/src/module/email" \
  "ecommerce-express/src/module/email/controller" \
  "ecommerce-express/src/module/email/service" \
  "ecommerce-express/src/module/email/repository" \
  "ecommerce-express/src/module/email/model" \
  "ecommerce-express/src/module/email/dto" \
  "ecommerce-express/src/module/email/route" \
  "ecommerce-express/src/module/email/schema" \
  "ecommerce-express/src/module/email/util" \
  "ecommerce-express/src/module/email/exception" \
  "ecommerce-express/src/module/webhook" \
  "ecommerce-express/src/module/webhook/controller" \
  "ecommerce-express/src/module/webhook/service" \
  "ecommerce-express/src/module/webhook/repository" \
  "ecommerce-express/src/module/webhook/model" \
  "ecommerce-express/src/module/webhook/dto" \
  "ecommerce-express/src/module/webhook/route" \
  "ecommerce-express/src/module/webhook/schema" \
  "ecommerce-express/src/module/webhook/handler" \
  "ecommerce-express/src/module/webhook/exception" \
  "ecommerce-express/src/module/mcp-server" \
  "ecommerce-express/src/module/mcp-server/controller" \
  "ecommerce-express/src/module/mcp-server/service" \
  "ecommerce-express/src/module/mcp-server/repository" \
  "ecommerce-express/src/module/mcp-server/model" \
  "ecommerce-express/src/module/mcp-server/dto" \
  "ecommerce-express/src/module/mcp-server/route" \
  "ecommerce-express/src/module/mcp-server/schema" \
  "ecommerce-express/src/module/mcp-server/saga" \
  "ecommerce-express/src/module/mcp-server/exception" \
  "ecommerce-express/src/module/marketing" \
  "ecommerce-express/src/module/marketing/controller" \
  "ecommerce-express/src/module/marketing/service" \
  "ecommerce-express/src/module/marketing/repository" \
  "ecommerce-express/src/module/marketing/model" \
  "ecommerce-express/src/module/marketing/dto" \
  "ecommerce-express/src/module/marketing/route" \
  "ecommerce-express/src/module/marketing/schema" \
  "ecommerce-express/src/module/marketing/exception" \
  "ecommerce-express/src/module/crm" \
  "ecommerce-express/src/module/crm/controller" \
  "ecommerce-express/src/module/crm/service" \
  "ecommerce-express/src/module/crm/repository" \
  "ecommerce-express/src/module/crm/model" \
  "ecommerce-express/src/module/crm/dto" \
  "ecommerce-express/src/module/crm/route" \
  "ecommerce-express/src/module/crm/schema" \
  "ecommerce-express/src/module/crm/exception" \
  "ecommerce-express/src/module/audit-log" \
  "ecommerce-express/src/module/audit-log/controller" \
  "ecommerce-express/src/module/audit-log/service" \
  "ecommerce-express/src/module/audit-log/repository" \
  "ecommerce-express/src/module/audit-log/model" \
  "ecommerce-express/src/module/audit-log/dto" \
  "ecommerce-express/src/module/audit-log/route" \
  "ecommerce-express/src/module/audit-log/schema" \
  "ecommerce-express/src/module/audit-log/exception" \
  "ecommerce-express/src/module/media" \
  "ecommerce-express/src/module/media/controller" \
  "ecommerce-express/src/module/media/service" \
  "ecommerce-express/src/module/media/repository" \
  "ecommerce-express/src/module/media/model" \
  "ecommerce-express/src/module/media/dto" \
  "ecommerce-express/src/module/media/route" \
  "ecommerce-express/src/module/media/schema" \
  "ecommerce-express/src/module/media/util" \
  "ecommerce-express/src/module/media/exception" \
  "ecommerce-express/src/module/dashboard" \
  "ecommerce-express/src/module/dashboard/controller" \
  "ecommerce-express/src/module/dashboard/service" \
  "ecommerce-express/src/module/dashboard/repository" \
  "ecommerce-express/src/module/dashboard/model" \
  "ecommerce-express/src/module/dashboard/dto" \
  "ecommerce-express/src/module/dashboard/route" \
  "ecommerce-express/src/module/dashboard/schema" \
  "ecommerce-express/src/module/dashboard/exception" \
  "ecommerce-express/src/shared" \
  "ecommerce-express/src/shared/middleware" \
  "ecommerce-express/src/shared/interceptor" \
  "ecommerce-express/src/shared/decorator" \
  "ecommerce-express/src/shared/filter" \
  "ecommerce-express/src/shared/pipe" \
  "ecommerce-express/src/shared/util" \
  "ecommerce-express/src/shared/types" \
  "ecommerce-express/src/shared/constants" \
  "ecommerce-express/src/config" \
  "ecommerce-express/prisma" \
  "ecommerce-express/prisma/migrations" \
  "ecommerce-express/test" \
  "ecommerce-express/test/unit" \
  "ecommerce-express/test/integration" \
  "ecommerce-express/test/e2e" \
  "ecommerce-express"

touch \
  "ecommerce-express/src/module/auth/controller/auth.controller.ts" \
  "ecommerce-express/src/module/auth/service/auth.service.ts" \
  "ecommerce-express/src/module/auth/repository/auth.repository.ts" \
  "ecommerce-express/src/module/auth/model/auth.model.ts" \
  "ecommerce-express/src/module/auth/dto/auth.dto.ts" \
  "ecommerce-express/src/module/auth/route/auth.route.ts" \
  "ecommerce-express/src/module/auth/schema/auth.schema.ts" \
  "ecommerce-express/src/module/auth/types/auth.types.ts" \
  "ecommerce-express/src/module/auth/util/token.util.ts" \
  "ecommerce-express/src/module/auth/guard/auth.guard.ts" \
  "ecommerce-express/src/module/auth/strategy/jwt.strategy.ts" \
  "ecommerce-express/src/module/auth/strategy/oauth.strategy.ts" \
  "ecommerce-express/src/module/auth/exception/auth.exception.ts" \
  "ecommerce-express/src/module/user/controller/user.controller.ts" \
  "ecommerce-express/src/module/user/service/user.service.ts" \
  "ecommerce-express/src/module/user/repository/user.repository.ts" \
  "ecommerce-express/src/module/user/model/user.model.ts" \
  "ecommerce-express/src/module/user/dto/user.dto.ts" \
  "ecommerce-express/src/module/user/route/user.route.ts" \
  "ecommerce-express/src/module/user/schema/user.schema.ts" \
  "ecommerce-express/src/module/user/types/user.types.ts" \
  "ecommerce-express/src/module/user/exception/user.exception.ts" \
  "ecommerce-express/src/module/role/controller/role.controller.ts" \
  "ecommerce-express/src/module/role/service/role.service.ts" \
  "ecommerce-express/src/module/role/repository/role.repository.ts" \
  "ecommerce-express/src/module/role/model/role.model.ts" \
  "ecommerce-express/src/module/role/dto/role.dto.ts" \
  "ecommerce-express/src/module/role/route/role.route.ts" \
  "ecommerce-express/src/module/role/schema/role.schema.ts" \
  "ecommerce-express/src/module/role/exception/role.exception.ts" \
  "ecommerce-express/src/module/permission/controller/permission.controller.ts" \
  "ecommerce-express/src/module/permission/service/permission.service.ts" \
  "ecommerce-express/src/module/permission/repository/permission.repository.ts" \
  "ecommerce-express/src/module/permission/model/permission.model.ts" \
  "ecommerce-express/src/module/permission/dto/permission.dto.ts" \
  "ecommerce-express/src/module/permission/route/permission.route.ts" \
  "ecommerce-express/src/module/permission/schema/permission.schema.ts" \
  "ecommerce-express/src/module/permission/exception/permission.exception.ts" \
  "ecommerce-express/src/module/product/controller/product.controller.ts" \
  "ecommerce-express/src/module/product/service/product.service.ts" \
  "ecommerce-express/src/module/product/repository/product.repository.ts" \
  "ecommerce-express/src/module/product/model/product.model.ts" \
  "ecommerce-express/src/module/product/dto/product.dto.ts" \
  "ecommerce-express/src/module/product/route/product.route.ts" \
  "ecommerce-express/src/module/product/schema/product.schema.ts" \
  "ecommerce-express/src/module/product/types/product.types.ts" \
  "ecommerce-express/src/module/product/exception/product.exception.ts" \
  "ecommerce-express/src/module/category/controller/category.controller.ts" \
  "ecommerce-express/src/module/category/service/category.service.ts" \
  "ecommerce-express/src/module/category/repository/category.repository.ts" \
  "ecommerce-express/src/module/category/model/category.model.ts" \
  "ecommerce-express/src/module/category/dto/category.dto.ts" \
  "ecommerce-express/src/module/category/route/category.route.ts" \
  "ecommerce-express/src/module/category/schema/category.schema.ts" \
  "ecommerce-express/src/module/category/exception/category.exception.ts" \
  "ecommerce-express/src/module/brand/controller/brand.controller.ts" \
  "ecommerce-express/src/module/brand/service/brand.service.ts" \
  "ecommerce-express/src/module/brand/repository/brand.repository.ts" \
  "ecommerce-express/src/module/brand/model/brand.model.ts" \
  "ecommerce-express/src/module/brand/dto/brand.dto.ts" \
  "ecommerce-express/src/module/brand/route/brand.route.ts" \
  "ecommerce-express/src/module/brand/schema/brand.schema.ts" \
  "ecommerce-express/src/module/brand/exception/brand.exception.ts" \
  "ecommerce-express/src/module/collection/controller/collection.controller.ts" \
  "ecommerce-express/src/module/collection/service/collection.service.ts" \
  "ecommerce-express/src/module/collection/repository/collection.repository.ts" \
  "ecommerce-express/src/module/collection/model/collection.model.ts" \
  "ecommerce-express/src/module/collection/dto/collection.dto.ts" \
  "ecommerce-express/src/module/collection/route/collection.route.ts" \
  "ecommerce-express/src/module/collection/schema/collection.schema.ts" \
  "ecommerce-express/src/module/collection/exception/collection.exception.ts" \
  "ecommerce-express/src/module/cart/controller/cart.controller.ts" \
  "ecommerce-express/src/module/cart/service/cart.service.ts" \
  "ecommerce-express/src/module/cart/repository/cart.repository.ts" \
  "ecommerce-express/src/module/cart/model/cart.model.ts" \
  "ecommerce-express/src/module/cart/dto/cart.dto.ts" \
  "ecommerce-express/src/module/cart/route/cart.route.ts" \
  "ecommerce-express/src/module/cart/schema/cart.schema.ts" \
  "ecommerce-express/src/module/cart/exception/cart.exception.ts" \
  "ecommerce-express/src/module/search/controller/search.controller.ts" \
  "ecommerce-express/src/module/search/service/search.service.ts" \
  "ecommerce-express/src/module/search/repository/search.repository.ts" \
  "ecommerce-express/src/module/search/model/search.model.ts" \
  "ecommerce-express/src/module/search/dto/search.dto.ts" \
  "ecommerce-express/src/module/search/route/search.route.ts" \
  "ecommerce-express/src/module/search/schema/search.schema.ts" \
  "ecommerce-express/src/module/search/exception/search.exception.ts" \
  "ecommerce-express/src/module/checkout/controller/checkout.controller.ts" \
  "ecommerce-express/src/module/checkout/service/checkout.service.ts" \
  "ecommerce-express/src/module/checkout/repository/checkout.repository.ts" \
  "ecommerce-express/src/module/checkout/model/checkout.model.ts" \
  "ecommerce-express/src/module/checkout/dto/checkout.dto.ts" \
  "ecommerce-express/src/module/checkout/route/checkout.route.ts" \
  "ecommerce-express/src/module/checkout/schema/checkout.schema.ts" \
  "ecommerce-express/src/module/checkout/exception/checkout.exception.ts" \
  "ecommerce-express/src/module/order/controller/order.controller.ts" \
  "ecommerce-express/src/module/order/service/order.service.ts" \
  "ecommerce-express/src/module/order/repository/order.repository.ts" \
  "ecommerce-express/src/module/order/model/order.model.ts" \
  "ecommerce-express/src/module/order/dto/order.dto.ts" \
  "ecommerce-express/src/module/order/route/order.route.ts" \
  "ecommerce-express/src/module/order/schema/order.schema.ts" \
  "ecommerce-express/src/module/order/event/order.event.ts" \
  "ecommerce-express/src/module/order/exception/order.exception.ts" \
  "ecommerce-express/src/module/payment/controller/payment.controller.ts" \
  "ecommerce-express/src/module/payment/service/payment.service.ts" \
  "ecommerce-express/src/module/payment/repository/payment.repository.ts" \
  "ecommerce-express/src/module/payment/model/payment.model.ts" \
  "ecommerce-express/src/module/payment/dto/payment.dto.ts" \
  "ecommerce-express/src/module/payment/route/payment.route.ts" \
  "ecommerce-express/src/module/payment/schema/payment.schema.ts" \
  "ecommerce-express/src/module/payment/util/payment.util.ts" \
  "ecommerce-express/src/module/payment/exception/payment.exception.ts" \
  "ecommerce-express/src/module/shipping/controller/shipping.controller.ts" \
  "ecommerce-express/src/module/shipping/service/shipping.service.ts" \
  "ecommerce-express/src/module/shipping/repository/shipping.repository.ts" \
  "ecommerce-express/src/module/shipping/model/shipping.model.ts" \
  "ecommerce-express/src/module/shipping/dto/shipping.dto.ts" \
  "ecommerce-express/src/module/shipping/route/shipping.route.ts" \
  "ecommerce-express/src/module/shipping/schema/shipping.schema.ts" \
  "ecommerce-express/src/module/shipping/exception/shipping.exception.ts" \
  "ecommerce-express/src/module/invoice/controller/invoice.controller.ts" \
  "ecommerce-express/src/module/invoice/service/invoice.service.ts" \
  "ecommerce-express/src/module/invoice/repository/invoice.repository.ts" \
  "ecommerce-express/src/module/invoice/model/invoice.model.ts" \
  "ecommerce-express/src/module/invoice/dto/invoice.dto.ts" \
  "ecommerce-express/src/module/invoice/route/invoice.route.ts" \
  "ecommerce-express/src/module/invoice/schema/invoice.schema.ts" \
  "ecommerce-express/src/module/invoice/util/pdf.util.ts" \
  "ecommerce-express/src/module/invoice/exception/invoice.exception.ts" \
  "ecommerce-express/src/module/refund/controller/refund.controller.ts" \
  "ecommerce-express/src/module/refund/service/refund.service.ts" \
  "ecommerce-express/src/module/refund/repository/refund.repository.ts" \
  "ecommerce-express/src/module/refund/model/refund.model.ts" \
  "ecommerce-express/src/module/refund/dto/refund.dto.ts" \
  "ecommerce-express/src/module/refund/route/refund.route.ts" \
  "ecommerce-express/src/module/refund/schema/refund.schema.ts" \
  "ecommerce-express/src/module/refund/exception/refund.exception.ts" \
  "ecommerce-express/src/module/coupon/controller/coupon.controller.ts" \
  "ecommerce-express/src/module/coupon/service/coupon.service.ts" \
  "ecommerce-express/src/module/coupon/repository/coupon.repository.ts" \
  "ecommerce-express/src/module/coupon/model/coupon.model.ts" \
  "ecommerce-express/src/module/coupon/dto/coupon.dto.ts" \
  "ecommerce-express/src/module/coupon/route/coupon.route.ts" \
  "ecommerce-express/src/module/coupon/schema/coupon.schema.ts" \
  "ecommerce-express/src/module/coupon/exception/coupon.exception.ts" \
  "ecommerce-express/src/module/loyalty/controller/loyalty.controller.ts" \
  "ecommerce-express/src/module/loyalty/service/loyalty.service.ts" \
  "ecommerce-express/src/module/loyalty/repository/loyalty.repository.ts" \
  "ecommerce-express/src/module/loyalty/model/loyalty.model.ts" \
  "ecommerce-express/src/module/loyalty/dto/loyalty.dto.ts" \
  "ecommerce-express/src/module/loyalty/route/loyalty.route.ts" \
  "ecommerce-express/src/module/loyalty/schema/loyalty.schema.ts" \
  "ecommerce-express/src/module/loyalty/util/nft.util.ts" \
  "ecommerce-express/src/module/loyalty/exception/loyalty.exception.ts" \
  "ecommerce-express/src/module/review/controller/review.controller.ts" \
  "ecommerce-express/src/module/review/service/review.service.ts" \
  "ecommerce-express/src/module/review/repository/review.repository.ts" \
  "ecommerce-express/src/module/review/model/review.model.ts" \
  "ecommerce-express/src/module/review/dto/review.dto.ts" \
  "ecommerce-express/src/module/review/route/review.route.ts" \
  "ecommerce-express/src/module/review/schema/review.schema.ts" \
  "ecommerce-express/src/module/review/exception/review.exception.ts" \
  "ecommerce-express/src/module/notification/controller/notification.controller.ts" \
  "ecommerce-express/src/module/notification/service/notification.service.ts" \
  "ecommerce-express/src/module/notification/repository/notification.repository.ts" \
  "ecommerce-express/src/module/notification/model/notification.model.ts" \
  "ecommerce-express/src/module/notification/dto/notification.dto.ts" \
  "ecommerce-express/src/module/notification/route/notification.route.ts" \
  "ecommerce-express/src/module/notification/schema/notification.schema.ts" \
  "ecommerce-express/src/module/notification/event/notification.event.ts" \
  "ecommerce-express/src/module/notification/exception/notification.exception.ts" \
  "ecommerce-express/src/module/social-commerce/controller/social.controller.ts" \
  "ecommerce-express/src/module/social-commerce/service/social.service.ts" \
  "ecommerce-express/src/module/social-commerce/repository/social.repository.ts" \
  "ecommerce-express/src/module/social-commerce/model/social.model.ts" \
  "ecommerce-express/src/module/social-commerce/dto/social.dto.ts" \
  "ecommerce-express/src/module/social-commerce/route/social.route.ts" \
  "ecommerce-express/src/module/social-commerce/schema/social.schema.ts" \
  "ecommerce-express/src/module/social-commerce/exception/social.exception.ts" \
  "ecommerce-express/src/module/automation/controller/automation.controller.ts" \
  "ecommerce-express/src/module/automation/service/automation.service.ts" \
  "ecommerce-express/src/module/automation/repository/automation.repository.ts" \
  "ecommerce-express/src/module/automation/model/automation.model.ts" \
  "ecommerce-express/src/module/automation/dto/automation.dto.ts" \
  "ecommerce-express/src/module/automation/route/automation.route.ts" \
  "ecommerce-express/src/module/automation/schema/automation.schema.ts" \
  "ecommerce-express/src/module/automation/exception/automation.exception.ts" \
  "ecommerce-express/src/module/communication/controller/communication.controller.ts" \
  "ecommerce-express/src/module/communication/service/communication.service.ts" \
  "ecommerce-express/src/module/communication/repository/communication.repository.ts" \
  "ecommerce-express/src/module/communication/model/communication.model.ts" \
  "ecommerce-express/src/module/communication/dto/communication.dto.ts" \
  "ecommerce-express/src/module/communication/route/communication.route.ts" \
  "ecommerce-express/src/module/communication/schema/communication.schema.ts" \
  "ecommerce-express/src/module/communication/event/communication.event.ts" \
  "ecommerce-express/src/module/communication/exception/communication.exception.ts" \
  "ecommerce-express/src/module/analytics/controller/analytics.controller.ts" \
  "ecommerce-express/src/module/analytics/service/analytics.service.ts" \
  "ecommerce-express/src/module/analytics/repository/analytics.repository.ts" \
  "ecommerce-express/src/module/analytics/model/analytics.model.ts" \
  "ecommerce-express/src/module/analytics/dto/analytics.dto.ts" \
  "ecommerce-express/src/module/analytics/route/analytics.route.ts" \
  "ecommerce-express/src/module/analytics/schema/analytics.schema.ts" \
  "ecommerce-express/src/module/analytics/event/analytics.event.ts" \
  "ecommerce-express/src/module/analytics/exception/analytics.exception.ts" \
  "ecommerce-express/src/module/inventory/controller/inventory.controller.ts" \
  "ecommerce-express/src/module/inventory/service/inventory.service.ts" \
  "ecommerce-express/src/module/inventory/repository/inventory.repository.ts" \
  "ecommerce-express/src/module/inventory/model/inventory.model.ts" \
  "ecommerce-express/src/module/inventory/dto/inventory.dto.ts" \
  "ecommerce-express/src/module/inventory/route/inventory.route.ts" \
  "ecommerce-express/src/module/inventory/schema/inventory.schema.ts" \
  "ecommerce-express/src/module/inventory/event/inventory.event.ts" \
  "ecommerce-express/src/module/inventory/exception/inventory.exception.ts" \
  "ecommerce-express/src/module/supplier/controller/supplier.controller.ts" \
  "ecommerce-express/src/module/supplier/service/supplier.service.ts" \
  "ecommerce-express/src/module/supplier/repository/supplier.repository.ts" \
  "ecommerce-express/src/module/supplier/model/supplier.model.ts" \
  "ecommerce-express/src/module/supplier/dto/supplier.dto.ts" \
  "ecommerce-express/src/module/supplier/route/supplier.route.ts" \
  "ecommerce-express/src/module/supplier/schema/supplier.schema.ts" \
  "ecommerce-express/src/module/supplier/exception/supplier.exception.ts" \
  "ecommerce-express/src/module/recommendation/controller/recommendation.controller.ts" \
  "ecommerce-express/src/module/recommendation/service/recommendation.service.ts" \
  "ecommerce-express/src/module/recommendation/repository/recommendation.repository.ts" \
  "ecommerce-express/src/module/recommendation/model/recommendation.model.ts" \
  "ecommerce-express/src/module/recommendation/dto/recommendation.dto.ts" \
  "ecommerce-express/src/module/recommendation/route/recommendation.route.ts" \
  "ecommerce-express/src/module/recommendation/schema/recommendation.schema.ts" \
  "ecommerce-express/src/module/recommendation/ml/recommendation.ml.ts" \
  "ecommerce-express/src/module/recommendation/exception/recommendation.exception.ts" \
  "ecommerce-express/src/module/graph-analysis/controller/graph.controller.ts" \
  "ecommerce-express/src/module/graph-analysis/service/graph.service.ts" \
  "ecommerce-express/src/module/graph-analysis/repository/graph.repository.ts" \
  "ecommerce-express/src/module/graph-analysis/model/graph.model.ts" \
  "ecommerce-express/src/module/graph-analysis/dto/graph.dto.ts" \
  "ecommerce-express/src/module/graph-analysis/route/graph.route.ts" \
  "ecommerce-express/src/module/graph-analysis/schema/graph.schema.ts" \
  "ecommerce-express/src/module/graph-analysis/ml/graph.ml.ts" \
  "ecommerce-express/src/module/graph-analysis/exception/graph.exception.ts" \
  "ecommerce-express/src/module/email/controller/email.controller.ts" \
  "ecommerce-express/src/module/email/service/email.service.ts" \
  "ecommerce-express/src/module/email/repository/email.repository.ts" \
  "ecommerce-express/src/module/email/model/email.model.ts" \
  "ecommerce-express/src/module/email/dto/email.dto.ts" \
  "ecommerce-express/src/module/email/route/email.route.ts" \
  "ecommerce-express/src/module/email/schema/email.schema.ts" \
  "ecommerce-express/src/module/email/util/template.util.ts" \
  "ecommerce-express/src/module/email/exception/email.exception.ts" \
  "ecommerce-express/src/module/webhook/controller/webhook.controller.ts" \
  "ecommerce-express/src/module/webhook/service/webhook.service.ts" \
  "ecommerce-express/src/module/webhook/repository/webhook.repository.ts" \
  "ecommerce-express/src/module/webhook/model/webhook.model.ts" \
  "ecommerce-express/src/module/webhook/dto/webhook.dto.ts" \
  "ecommerce-express/src/module/webhook/route/webhook.route.ts" \
  "ecommerce-express/src/module/webhook/schema/webhook.schema.ts" \
  "ecommerce-express/src/module/webhook/handler/webhook.handler.ts" \
  "ecommerce-express/src/module/webhook/exception/webhook.exception.ts" \
  "ecommerce-express/src/module/mcp-server/controller/mcp.controller.ts" \
  "ecommerce-express/src/module/mcp-server/service/mcp.service.ts" \
  "ecommerce-express/src/module/mcp-server/repository/mcp.repository.ts" \
  "ecommerce-express/src/module/mcp-server/model/mcp.model.ts" \
  "ecommerce-express/src/module/mcp-server/dto/mcp.dto.ts" \
  "ecommerce-express/src/module/mcp-server/route/mcp.route.ts" \
  "ecommerce-express/src/module/mcp-server/schema/mcp.schema.ts" \
  "ecommerce-express/src/module/mcp-server/saga/mcp.saga.ts" \
  "ecommerce-express/src/module/mcp-server/exception/mcp.exception.ts" \
  "ecommerce-express/src/module/marketing/controller/marketing.controller.ts" \
  "ecommerce-express/src/module/marketing/service/marketing.service.ts" \
  "ecommerce-express/src/module/marketing/repository/marketing.repository.ts" \
  "ecommerce-express/src/module/marketing/model/marketing.model.ts" \
  "ecommerce-express/src/module/marketing/dto/marketing.dto.ts" \
  "ecommerce-express/src/module/marketing/route/marketing.route.ts" \
  "ecommerce-express/src/module/marketing/schema/marketing.schema.ts" \
  "ecommerce-express/src/module/marketing/exception/marketing.exception.ts" \
  "ecommerce-express/src/module/crm/controller/crm.controller.ts" \
  "ecommerce-express/src/module/crm/service/crm.service.ts" \
  "ecommerce-express/src/module/crm/repository/crm.repository.ts" \
  "ecommerce-express/src/module/crm/model/crm.model.ts" \
  "ecommerce-express/src/module/crm/dto/crm.dto.ts" \
  "ecommerce-express/src/module/crm/route/crm.route.ts" \
  "ecommerce-express/src/module/crm/schema/crm.schema.ts" \
  "ecommerce-express/src/module/crm/exception/crm.exception.ts" \
  "ecommerce-express/src/module/audit-log/controller/audit.controller.ts" \
  "ecommerce-express/src/module/audit-log/service/audit.service.ts" \
  "ecommerce-express/src/module/audit-log/repository/audit.repository.ts" \
  "ecommerce-express/src/module/audit-log/model/audit.model.ts" \
  "ecommerce-express/src/module/audit-log/dto/audit.dto.ts" \
  "ecommerce-express/src/module/audit-log/route/audit.route.ts" \
  "ecommerce-express/src/module/audit-log/schema/audit.schema.ts" \
  "ecommerce-express/src/module/audit-log/exception/audit.exception.ts" \
  "ecommerce-express/src/module/media/controller/media.controller.ts" \
  "ecommerce-express/src/module/media/service/media.service.ts" \
  "ecommerce-express/src/module/media/repository/media.repository.ts" \
  "ecommerce-express/src/module/media/model/media.model.ts" \
  "ecommerce-express/src/module/media/dto/media.dto.ts" \
  "ecommerce-express/src/module/media/route/media.route.ts" \
  "ecommerce-express/src/module/media/schema/media.schema.ts" \
  "ecommerce-express/src/module/media/util/image.util.ts" \
  "ecommerce-express/src/module/media/exception/media.exception.ts" \
  "ecommerce-express/src/module/dashboard/controller/dashboard.controller.ts" \
  "ecommerce-express/src/module/dashboard/service/dashboard.service.ts" \
  "ecommerce-express/src/module/dashboard/repository/dashboard.repository.ts" \
  "ecommerce-express/src/module/dashboard/model/dashboard.model.ts" \
  "ecommerce-express/src/module/dashboard/dto/dashboard.dto.ts" \
  "ecommerce-express/src/module/dashboard/route/dashboard.route.ts" \
  "ecommerce-express/src/module/dashboard/schema/dashboard.schema.ts" \
  "ecommerce-express/src/module/dashboard/exception/dashboard.exception.ts" \
  "ecommerce-express/src/shared/middleware/jwt.middleware.ts" \
  "ecommerce-express/src/shared/middleware/rbac.middleware.ts" \
  "ecommerce-express/src/shared/middleware/rate-limit.middleware.ts" \
  "ecommerce-express/src/shared/middleware/cors.middleware.ts" \
  "ecommerce-express/src/shared/middleware/logger.middleware.ts" \
  "ecommerce-express/src/shared/middleware/error.middleware.ts" \
  "ecommerce-express/src/shared/interceptor/cache.interceptor.ts" \
  "ecommerce-express/src/shared/interceptor/transform.interceptor.ts" \
  "ecommerce-express/src/shared/decorator/auth.decorator.ts" \
  "ecommerce-express/src/shared/decorator/validate.decorator.ts" \
  "ecommerce-express/src/shared/filter/http-exception.filter.ts" \
  "ecommerce-express/src/shared/pipe/validation.pipe.ts" \
  "ecommerce-express/src/shared/pipe/transform.pipe.ts" \
  "ecommerce-express/src/shared/util/pagination.util.ts" \
  "ecommerce-express/src/shared/util/crypto.util.ts" \
  "ecommerce-express/src/shared/util/date.util.ts" \
  "ecommerce-express/src/shared/util/slugify.util.ts" \
  "ecommerce-express/src/shared/types/common.types.ts" \
  "ecommerce-express/src/shared/types/pagination.types.ts" \
  "ecommerce-express/src/shared/types/api-response.types.ts" \
  "ecommerce-express/src/shared/constants/http.constants.ts" \
  "ecommerce-express/src/shared/constants/roles.constants.ts" \
  "ecommerce-express/src/config/app.config.ts" \
  "ecommerce-express/src/config/database.config.ts" \
  "ecommerce-express/src/config/redis.config.ts" \
  "ecommerce-express/src/config/jwt.config.ts" \
  "ecommerce-express/src/config/graphql.config.ts" \
  "ecommerce-express/src/config/stripe.config.ts" \
  "ecommerce-express/src/config/cloudinary.config.ts" \
  "ecommerce-express/src/config/socket.config.ts" \
  "ecommerce-express/src/config/swagger.config.ts" \
  "ecommerce-express/src/app.ts" \
  "ecommerce-express/src/server.ts" \
  "ecommerce-express/prisma/schema.prisma" \
  "ecommerce-express/prisma/seed.ts" \
  "ecommerce-express/.env" \
  "ecommerce-express/.env.example" \
  "ecommerce-express/tsconfig.json" \
  "ecommerce-express/jest.config.ts" \
  "ecommerce-express/Dockerfile" \
  "ecommerce-express/package.json"
```

---

## 4. Scripts recomendados en `package.json`

```bash
pnpm pkg set scripts.dev="ts-node-dev --respawn --transpile-only src/server.ts"
pnpm pkg set scripts.build="tsc"
pnpm pkg set scripts.start="node dist/server.js"
pnpm pkg set scripts.test="jest"
pnpm pkg set scripts.prisma:migrate="prisma migrate dev"
pnpm pkg set scripts.prisma:studio="prisma studio"
pnpm pkg set scripts.prisma:seed="ts-node prisma/seed.ts"
pnpm pkg set scripts.lint="eslint ."
pnpm pkg set scripts.typecheck="tsc --noEmit"
```

---

## 5. Levantar servicios de infraestructura (compose único en infra/docker/)

```bash
pnpm dev:up   # desde la raíz del monorepo
pnpm prisma:migrate
pnpm dev
```

---

## 5.1 Textos generados por el backend en español e inglés

- `src/shared/util/i18n.util.ts`: idioma de la request (`Accept-Language`), rutas del frontend por idioma (`/en/...`) y formato de moneda.
- `src/shared/constants/messages.constants.ts`: diccionarios **tipados** es/en de notificaciones, emails y conceptos de puntos. Si a un idioma le falta una clave o un parámetro, el proyecto no compila.
- Notificaciones: se guardan en MongoDB como **clave + parámetros** y se redactan al leerlas, en el idioma de quien consulta.
- Emails y push: se redactan en el idioma preferido del usuario (`users.locale`); los enlaces apuntan a `/en/...` cuando corresponde.
- Puntos: `loyalty_transactions.reasonCode` + `reasonParams` se traducen al leer; los ajustes manuales de un admin se muestran tal cual.
- Migración `prisma/migrations/20260930000000_backend_i18n` (se aplica con `pnpm prisma:deploy`). Pruebas: `test/unit/i18n.spec.ts`.
- Textos que escribe una persona (motivo de cancelación, mensaje de un admin) se muestran en el idioma en que se escribieron.

## 6. Estado de implementación (Fases 0–4) y archivos agregados

| Fase | Módulos Express | Estado |
|------|-----------------|--------|
| 0 | Prisma (38 tablas + pgvector + FTS en español), Mongo, seeds, config, shared | ✅ Implementado |
| 1 | auth (JWT, refresh rotativo, OAuth2, 2FA por email, SIWE + vinculación de wallet), user, role, permission | ✅ Implementado |
| 2 | product, category, brand, collection, media (Cloudinary), GraphQL de catálogo | ✅ Implementado |
| 3 | cart (Redis TTL), search (FTS + facetas + pgvector), checkout (saga), order, payment (Stripe), shipping | ✅ Implementado |
| 4 | invoice (DIAN habilitación + PDF), refund, coupon, loyalty (NFT ERC-721 + IPFS), review, notification, email (servicio) | ✅ Implementado |
| 5–11 | social-commerce, automation, communication, analytics, inventory, supplier, recommendation, graph-analysis, webhook, mcp-server, marketing, crm, audit-log, dashboard | ⏳ Archivos vacíos del scaffold (fases futuras) |

Archivos agregados que no estaban en el árbol de `01_EXPRESS_TS.md` (cada uno explica su motivo en el encabezado):

| Archivo | Motivo |
|---------|--------|
| `src/config/passport.config.ts` | Registro de la estrategia JWT de Passport en un solo lugar |
| `src/shared/util/event-bus.util.ts` | `TypedEventBus` (Observer tipado) para eventos entre módulos |
| `tsconfig.build.json` | Compila solo `src/` (el `tsconfig.json` también incluye tests y seeds para el typecheck) |
| `test/unit/*.spec.ts` | Pruebas unitarias de dominio, media y generación OpenAPI |

Pendientes conocidos: los módulos `email` y `media` implementan solo las capas que usan las fases 0–4; su administración (bitácora de envíos, carpetas de medios: `controller`/`repository` de email, `MediaFolder`) corresponde a la Fase 7.
