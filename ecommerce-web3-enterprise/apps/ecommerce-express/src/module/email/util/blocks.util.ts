// blocks.util.ts (TypeScript puro + node:crypto) => utilidades del correo de marketing:
//  - RF-21.6 diseñador visual: bloques (título, texto, imagen, botón, producto, separador, espacio) -> HTML de correo
//    compatible (tablas + estilos inline). El texto admite "{{ firstName }}" (se personaliza al enviar).
//  - RF-21.5 seguimiento de clics: cada enlace pasa por /email/:id/click con firma HMAC (no es un redirector abierto)
//    y lleva UTM de la campaña (las ventas quedan atribuidas al correo).
// Paradigma: funcional (funciones puras). Patrones: Builder (bloques -> HTML) + Interpreter (cada tipo se renderiza).
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { escapeHtml } from "./template.util";

const Url = z.string().url().startsWith("https://").or(z.string().regex(/^\{\{\s*\w+\s*\}\}$/)); // URL segura o variable
// BlockSchema => unión discriminada por "type": cada bloque valida SOLO sus campos (tipado seguro de punta a punta)
export const BlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string().max(200), align: z.enum(["left", "center"]).default("left") }),
  z.object({ type: z.literal("text"), text: z.string().max(5000) }),
  z.object({ type: z.literal("image"), src: Url, alt: z.string().max(200), href: Url.optional() }),
  z.object({ type: z.literal("button"), label: z.string().max(80), href: Url, color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#0f172a") }),
  z.object({ type: z.literal("product"), name: z.string().max(160), price: z.string().max(40), imageUrl: Url, href: Url }),
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("spacer"), height: z.number().int().min(4).max(80).default(16) }),
]);
export type EmailBlock = z.infer<typeof BlockSchema>;

// Los valores de texto se escapan, pero los marcadores "{{ x }}" quedan intactos para renderTemplate
const text = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");

// renderBlock => HTML de un bloque (Interpreter: un caso por tipo; el compilador exige cubrirlos todos)
function renderBlock(block: EmailBlock): string {
  switch (block.type) {
    case "heading":
      return `<h2 style="font-size:22px;margin:0 0 12px;text-align:${block.align}">${text(block.text)}</h2>`;
    case "text":
      return `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${text(block.text)}</p>`;
    case "image": {
      const img = `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" width="496" style="display:block;width:100%;height:auto;border:0;border-radius:6px">`;
      return `<div style="margin:0 0 12px">${block.href ? `<a href="${escapeHtml(block.href)}">${img}</a>` : img}</div>`;
    }
    case "button":
      return `<p style="margin:16px 0;text-align:center"><a href="${escapeHtml(block.href)}" style="background:${block.color};color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold">${text(block.label)}</a></p>`;
    case "product":
      return `<table role="presentation" width="100%" style="margin:0 0 12px;border:1px solid #e2e8f0;border-radius:6px"><tr>
        <td width="120" style="padding:8px"><a href="${escapeHtml(block.href)}"><img src="${escapeHtml(block.imageUrl)}" alt="${escapeHtml(block.name)}" width="104" style="display:block;border-radius:4px"></a></td>
        <td style="padding:8px"><p style="margin:0 0 4px;font-weight:bold">${text(block.name)}</p><p style="margin:0 0 8px;color:#0f172a">${text(block.price)}</p>
        <a href="${escapeHtml(block.href)}" style="color:#2563eb">Ver producto</a></td></tr></table>`;
    case "divider":
      return `<hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0">`;
    case "spacer":
      return `<div style="height:${block.height}px;line-height:${block.height}px">&nbsp;</div>`;
  }
}

// renderBlocks => documento completo (contenedor de 560 px centrado: estándar de correo, mobile-friendly)
export function renderBlocks(blocks: EmailBlock[], locale = "es"): string {
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px"><tr><td style="padding:32px">
${blocks.map(renderBlock).join("\n")}
</td></tr></table></td></tr></table></body></html>`;
}

// ---------- RF-21.5 seguimiento de clics ----------
// signLink => HMAC-SHA256(secreto, logId|url) en base64url (corta): solo los enlaces que generó la tienda redirigen
export const signLink = (secret: string, logId: string, url: string) => createHmac("sha256", secret).update(`${logId}|${url}`).digest("base64url").slice(0, 22);

export function verifyLink(secret: string, logId: string, url: string, signature: string): boolean {
  const expected = Buffer.from(signLink(secret, logId, url));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// withUtm => agrega UTM de la campaña sin pisar parámetros existentes (atribución de la venta al correo)
export function withUtm(url: string, campaignId: string | null): string {
  if (!campaignId) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("utm_source")) parsed.searchParams.set("utm_source", "store");
    if (!parsed.searchParams.has("utm_medium")) parsed.searchParams.set("utm_medium", "email");
    if (!parsed.searchParams.has("utm_campaign")) parsed.searchParams.set("utm_campaign", campaignId);
    return parsed.toString();
  } catch {
    return url;
  }
}

// trackLinks => reescribe cada href http(s) del correo hacia el endpoint de clics (mailto:, tel: y anclas se respetan)
export function trackLinks(html: string, logId: string, campaignId: string | null, base: string, secret: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, raw: string) => {
    const target = withUtm(raw.replace(/&amp;/g, "&"), campaignId);
    return `href="${base}/api/v1/email/${logId}/click?u=${encodeURIComponent(target)}&amp;s=${signLink(secret, logId, target)}"`;
  });
}
