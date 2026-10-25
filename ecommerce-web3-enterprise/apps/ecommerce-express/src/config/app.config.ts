// app.config.ts (TypeScript + Zod) => configuración ÚNICA de la aplicación, validada al arrancar.
// Patrón: "Fail Fast" + Singleton de configuración (12-Factor App: la config vive en variables de entorno).
// Si falta una variable obligatoria el proceso se detiene con un mensaje claro, en vez de fallar
// minutos después en el primer request que la use. Paradigma declarativo: el schema describe la config.
import "dotenv/config"; // Carga .env en process.env ANTES de validar (idempotente si server.ts ya lo cargó)
import { z } from "zod"; // Librería de validación en runtime con inferencia de tipos

// "z.coerce.number()" => convierte el string del entorno a número (process.env solo contiene strings)
// ".default(x)" => valor por defecto si la variable no existe | ".optional()" => integración desactivada si falta
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  // Lista separada por comas => se transforma en arreglo (".transform" = paso funcional de mapeo)
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001")
    .transform((value) => value.split(",").map((origin) => origin.trim())),

  // --- Persistencia ---
  DATABASE_URL: z.string().min(1),
  MONGO_URL: z.string().default("mongodb://localhost:27018/ecommerce_docs"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // --- JWT ---
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // --- Correo (Nodemailer) ---
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025), // 1025 = Mailpit/MailHog en desarrollo
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("eCommerce Web3 <no-reply@ecommerce-web3.dev>"),

  // --- Comercio ---
  DEFAULT_CURRENCY: z.string().length(3).default("COP"),
  TAX_RATE: z.coerce.number().min(0).max(1).default(0.19), // IVA Colombia 19%
  CHECKOUT_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  CART_TTL_DAYS: z.coerce.number().int().positive().default(30),
  LOYALTY_POINTS_PER_UNIT: z.coerce.number().int().positive().default(100_000), // 1 punto por cada $1.000 COP (100.000 en unidad mínima)
  // RF-07.3 / RF-08.7 canje: valor de 1 punto (unidad mínima; 1.000 = $10 COP => 1 % de devolución) y tope por pedido
  LOYALTY_POINT_VALUE_CENTS: z.coerce.number().int().positive().default(1_000),
  LOYALTY_MAX_REDEEM_PERCENT: z.coerce.number().int().min(1).max(100).default(50),
  // RF-07.6 horas sin actividad para recordar un carrito abandonado (un recordatorio por cada inactividad)
  // RF-08.2 / RF-09.1 geocodificación (autocompletado de direcciones y mapa del paquete): OpenStreetMap Nominatim
  NOMINATIM_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  ABANDONED_CART_HOURS: z.coerce.number().int().min(1).max(720).default(4),

  // --- Integraciones (opcionales: sin credenciales la integración responde 503 SERVICE_UNAVAILABLE) ---
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  // RF-26.5 marca de agua: logo subido a Cloudinary (public_id) o, sin él, este texto
  WATERMARK_PUBLIC_ID: z.string().optional(),
  WATERMARK_TEXT: z.string().default("eCommerce Web3"),
  // --- Azure (OPCIONAL, apagado por defecto) ---
  // Solo "true" lo activa; sin él se usan las alternativas gratuitas (SMTP, .env, logs locales)
  AZURE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  AZURE_KEY_VAULT_URL: z.string().url().optional(), // Lo lee azure.config.ts antes de validar este esquema
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),
  AZURE_COMMUNICATION_CONNECTION_STRING: z.string().optional(),
  AZURE_EMAIL_SENDER: z.string().email().optional(),

  // Revalidación ISR bajo demanda del storefront Next.js (POST /api/revalidate con secreto compartido)
  STOREFRONT_REVALIDATE_URL: z.string().url().optional(),
  REVALIDATE_SECRET: z.string().min(16).optional(),
  FASTAPI_URL: z.string().url().default("http://localhost:8000"),
  DIAN_INVOICE_PREFIX: z.string().default("SETP"),
  DIAN_TECHNICAL_KEY: z.string().default("fc8eac422eba16e22ffd8c6f94b3f40a6e38162c"), // Clave técnica del SET de PRUEBAS DIAN
  DIAN_SELLER_NIT: z.string().default("900000000"),
  DIAN_ENVIRONMENT: z.enum(["1", "2"]).default("2"), // 1 = producción, 2 = habilitación/pruebas
  WEB3_RPC_URL: z.string().optional(),
  WEB3_PRIVATE_KEY: z.string().optional(),
  NFT_CONTRACT_ADDRESS: z.string().optional(),
  POP_NFT_CONTRACT_ADDRESS: z.string().optional(), // RF-29.3 contrato ERC-721 de pruebas de compra (opcional)
  // --- Fase 9 (Blockchain Integration en Express): multi-chain EVM ---
  // Cadena por defecto de /api/v1/rt/blockchain (clave de chain.config.ts). "sepolia" = testnet: sin dinero real
  WEB3_DEFAULT_CHAIN: z.string().default("sepolia"),
  // RPC propios por cadena "polygon=https://...,sepolia=https://..."; sin valor se usan RPC públicos gratuitos
  WEB3_RPC_URLS: z
    .string()
    .default("")
    .transform((value) =>
      Object.fromEntries(
        value
          .split(",")
          .map((pair) => pair.split("=").map((part) => part.trim()))
          .filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1]))
      )
    ),
  IPFS_API_URL: z.string().optional(), // Nodo IPFS (Kubo HTTP RPC) o servicio de pinning compatible
  IPFS_GATEWAY_URL: z.string().default("https://ipfs.io/ipfs"),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  // Web Push estándar (PWA de Nuxt, Fase 8): par VAPID (npx web-push generate-vapid-keys) + contacto del emisor
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:soporte@ecommerce.local"),

  // --- Fase 6: IA local (LangChain + Ollama), Social Commerce y n8n ---
  // Ollama corre en el equipo (0 USD). Mismo modelo pequeño que FastAPI => Ollama mantiene UNA sola copia en RAM
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:3b"),
  // "keep_alive" corto => Ollama descarga el modelo de la RAM/VRAM tras 2 min sin uso (ahorro de energía)
  OLLAMA_KEEP_ALIVE: z.string().default("2m"),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().max(1024).default(256), // Tope de tokens generados por respuesta
  META_GRAPH_VERSION: z.string().default("v21.0"), // Versión de la Graph API de Meta (Instagram + Facebook)
  META_ACCESS_TOKEN: z.string().optional(), // Token de página con permisos instagram_content_publish / pages_manage_posts
  INSTAGRAM_ACCOUNT_ID: z.string().optional(),
  FACEBOOK_PAGE_ID: z.string().optional(),
  TIKTOK_ACCESS_TOKEN: z.string().optional(),
  N8N_API_URL: z.string().url().optional(), // API pública de n8n (http://n8n:5678/api/v1); opcional
  N8N_API_KEY: z.string().optional(),
  // Base de los webhooks de n8n: Express SOLO llama URLs bajo esta base (evita SSRF con URLs arbitrarias)
  N8N_WEBHOOK_URL: z.string().url().default("http://localhost:5678/webhook"),

  // --- Fase 7: Analytics, Admin & Integrations ---
  // Retención del audit trail (días): índice TTL de MongoDB => los logs vencidos se borran solos (menos disco)
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
  // Umbral de stock disponible por variante para alertas de "stock bajo" (inventario y KPIs del dashboard)
  LOW_STOCK_THRESHOLD: z.coerce.number().int().min(0).default(5),
  // SuiteCRM 8 (open source, opcional): sin URL el CRM funciona solo con la base propia (sin sincronizar)
  SUITECRM_URL: z.string().url().optional(),
  SUITECRM_CLIENT_ID: z.string().optional(),
  SUITECRM_CLIENT_SECRET: z.string().optional(),

  // --- RF 01-02: Auth y cuenta ---
  // SMS (RF-01.1, verificación de teléfono) con la API REST de Twilio; sin credenciales el código se escribe en el
  // log del servidor (desarrollo gratis, igual que Mailpit para el correo)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(), // Número remitente E.164 (+1...) o Messaging Service SID (MG...)
  // OAuth (RF-01.2): FACEBOOK_APP_SECRET firma el appsecret_proof (Meta rechaza tokens de OTRA app);
  // APPLE_CLIENT_ID = Services ID de "Sign in with Apple": audiencia ("aud") obligatoria del id_token
  FACEBOOK_APP_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),

  // --- RF 16–20: WhatsApp, Chatwoot, catálogos sociales y NLU ---
  // WhatsApp Business Cloud API (RF-16.1 / RF-19.1 / RF-20.2). Sin número ni token el mensaje se escribe en el log
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(), // Si falta se usa META_ACCESS_TOKEN (permiso whatsapp_business_messaging)
  WHATSAPP_TEMPLATE: z.string().optional(), // Plantilla aprobada con un parámetro {{1}} (mensajes fuera de la ventana de 24 h)
  META_CATALOG_ID: z.string().optional(), // Catálogo de Meta Commerce: Facebook Shop, Instagram Shopping y WhatsApp (RF-19.1/19.7)
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(), // "hub.verify_token" al suscribir los webhooks de pedidos de Meta (RF-19.3)
  // Chatwoot (RF-17.11) hub de agentes humanos: API de la cuenta + bandeja API donde se crean las conversaciones
  CHATWOOT_URL: z.string().url().optional(),
  CHATWOOT_API_TOKEN: z.string().optional(),
  CHATWOOT_ACCOUNT_ID: z.string().optional(),
  CHATWOOT_INBOX_ID: z.string().optional(),
  CHATWOOT_WEBHOOK_TOKEN: z.string().optional(), // Se agrega como ?token= en la URL del webhook configurado en Chatwoot
  // TikTok Shop Open API (RF-19.7): firma HMAC-SHA256 con app_secret
  TIKTOK_SHOP_APP_KEY: z.string().optional(),
  TIKTOK_SHOP_APP_SECRET: z.string().optional(),
  TIKTOK_SHOP_ACCESS_TOKEN: z.string().optional(),
  TIKTOK_SHOP_CIPHER: z.string().optional(),
  TIKTOK_SHOP_CATEGORY_ID: z.string().optional(), // Categoría de TikTok para los productos nuevos
  TIKTOK_SHOP_WAREHOUSE_ID: z.string().optional(), // Bodega de TikTok donde se reporta el inventario
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(), // WABA a la que se conecta el catálogo de Meta (RF-19.1)
  // Tienda pública (Nuxt): enlaces de los productos en los catálogos sociales
  STORE_URL: z.string().url().default("http://localhost:3001"),
  // RF-17.10 por debajo de esta confianza de intención el bot escala a una persona
  NLU_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.45),
});

// "export type" => tipo inferido del schema (DRY: el tipo y la validación no se desincronizan)
export type AppConfig = z.infer<typeof EnvSchema>;

// "safeParse" => no lanza: devuelve { success, data | error } para poder formatear el mensaje (Result pattern)
// Variables vacías ("AZURE_KEY_VAULT_URL=") => se tratan como ausentes, para que apliquen ".optional()" y ".default()"
const parsed = EnvSchema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== "")));

// Guard clause: configuración inválida => se detiene el arranque con el detalle de cada variable
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Configuración de entorno inválida:\n${details}`);
}

// "Object.freeze" => configuración inmutable en runtime: ningún módulo puede modificarla por accidente
export const appConfig: Readonly<AppConfig> = Object.freeze(parsed.data);

// Helper semántico usado para activar comportamientos solo en producción (ej. cookies "secure")
export const isProduction = appConfig.NODE_ENV === "production";
