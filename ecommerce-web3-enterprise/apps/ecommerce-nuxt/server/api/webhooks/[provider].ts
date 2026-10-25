// [provider].ts (Nitro, POST /api/webhooks/:provider) => recibe webhooks de Express (módulo Webhooks, eventos del CMS)
// o de n8n y PURGA la caché ISR de las páginas afectadas: el contenido nuevo se ve al instante sin esperar la hora
// del ISR y sin regenerar todo el sitio (ahorro de CPU). Seguridad: firma HMAC-SHA256 del cuerpo crudo comparada en
// tiempo constante (timingSafeEqual) y lista blanca de proveedores. Patrón Handler + Strategy (proveedor -> acción).
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const PROVIDERS = ["express", "n8n"] as const;
// Payload mínimo: tipo de contenido y slug (para purgar solo esas rutas)
const PayloadSchema = z.object({ event: z.string().max(80), data: z.object({ kind: z.enum(["page", "landing", "lookbook", "event", "collection", "category"]).optional(), slug: z.string().max(120).optional() }).default({}) });
const PREFIX: Record<string, string> = { page: "cms-page", landing: "landing", lookbook: "cms-lookbook", event: "events", collection: "cms-collection", category: "categories" };

// validSignature => mismo esquema que webhook.handler.ts de Express: "X-Webhook-Signature: t=<unix>,v1=<hex>" con
// HMAC de "<t>.<cuerpo>". Se rechazan firmas de más de 5 minutos (anti-replay) y se compara en tiempo constante.
const TOLERANCE_SECONDS = 300;
export function validSignature(raw: string, header: string | undefined, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=") as [string, string]));
  const timestamp = Number(parts["t"]);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > TOLERANCE_SECONDS || !parts["v1"]) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex"));
  const received = Buffer.from(parts["v1"]);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, "provider");
  if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) throw createError({ statusCode: 404 });
  const raw = (await readRawBody(event, "utf8")) ?? "";
  if (!validSignature(raw, getHeader(event, "x-webhook-signature"), useRuntimeConfig().webhookSecret)) throw createError({ statusCode: 401, statusMessage: "INVALID_SIGNATURE" });

  const parsed = PayloadSchema.safeParse(JSON.parse(raw || "{}"));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: "VALIDATION_ERROR" });
  const { kind, slug } = parsed.data.data;

  // Nitro guarda el ISR en el almacenamiento "cache" (claves nitro:routes:_:...): se borran las de la sección
  const storage = useStorage("cache");
  const section = kind ? PREFIX[kind] : undefined;
  const keys = (await storage.getKeys("nitro:routes")).filter((key) => !section || key.includes(section) || (slug && key.includes(slug)));
  await Promise.all(keys.map((key) => storage.removeItem(key)));
  return { purged: keys.length };
});
