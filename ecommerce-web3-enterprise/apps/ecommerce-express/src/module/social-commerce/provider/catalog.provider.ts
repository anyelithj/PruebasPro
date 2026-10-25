// catalog.provider.ts (Express · axios · node:crypto) => adaptadores de catálogo y pedidos de los canales sociales:
//  - MetaCatalogChannel (RF-19.1 / RF-19.7): Catalog Batch API de Meta. UN catálogo alimenta Facebook Shop, Instagram
//    Shopping, Facebook Marketplace (tiendas elegibles) y el catálogo de WhatsApp Business (se conecta a la WABA).
//  - TikTokShopChannel (RF-19.7): TikTok Shop Open API 202309 con firma HMAC-SHA256 (productos, inventario, pedidos).
// Patrones: Strategy + Adapter (cada canal implementa CatalogChannelPort) y Null Object (sin credenciales "configured"
// es false y el canal se omite). Paradigma: POO + funcional (firma = función pura, testeable).
import { createHmac } from "node:crypto";
import axios from "axios";
import { appConfig } from "../../../config/app.config";
import type { CatalogChannel } from "../model/channel.model";

// CatalogItem => una variante vendible lista para publicar (precio en centavos, stock disponible real)
export interface CatalogItem {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  description: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  available: number;
  imageUrl: string | null;
  link: string;
  brand: string | null;
}

// ChannelOrder => pedido de un canal externo normalizado (lo importa channel.service a PostgreSQL)
export interface ChannelOrder {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: { line1: string; line2: string | null; city: string; state: string; postalCode: string; country: string };
  items: Array<{ sku: string; quantity: number; unitPriceCents: number }>;
  shippingCents: number;
}

export interface SyncResult {
  sku: string;
  externalId?: string | null;
  externalSkuId?: string | null;
  error?: string | null;
}

export interface CatalogChannelPort {
  readonly channel: CatalogChannel;
  readonly configured: boolean;
  upsert(items: CatalogItem[], known: Map<string, { externalId: string | null; externalSkuId: string | null }>): Promise<SyncResult[]>;
  updateInventory(items: Array<{ sku: string; available: number; externalId: string | null; externalSkuId: string | null }>): Promise<void>;
  fetchOrder(externalId: string): Promise<ChannelOrder | null>;
}

const money = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`; // "120000.00 COP"
const graph = (path: string) => `https://graph.facebook.com/${appConfig.META_GRAPH_VERSION}/${path}`;

// ---------- Meta (Facebook / Instagram / Marketplace / WhatsApp) ----------
export class MetaCatalogChannel implements CatalogChannelPort {
  public readonly channel = "META" as const;

  public get configured(): boolean {
    return Boolean(appConfig.META_ACCESS_TOKEN && appConfig.META_CATALOG_ID);
  }

  // upsert => items_batch con método UPDATE (crea si no existe): "id" = SKU (retailer_id), "item_group_id" agrupa
  // las variantes del mismo producto. Lotes de 1000 (máximo de la API)
  public async upsert(items: CatalogItem[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (let index = 0; index < items.length; index += 1000) {
      const batch = items.slice(index, index + 1000);
      const requests = batch.map((item) => ({
        method: "UPDATE",
        data: {
          id: item.sku,
          item_group_id: item.productId,
          title: item.title.slice(0, 150),
          description: item.description.slice(0, 5000),
          availability: item.available > 0 ? "in stock" : "out of stock",
          inventory: item.available,
          condition: "new",
          price: money(item.compareAtPriceCents && item.compareAtPriceCents > item.priceCents ? item.compareAtPriceCents : item.priceCents, item.currency),
          ...(item.compareAtPriceCents && item.compareAtPriceCents > item.priceCents ? { sale_price: money(item.priceCents, item.currency) } : {}),
          link: item.link,
          image_link: item.imageUrl ?? undefined,
          brand: item.brand ?? "Tienda",
        },
      }));
      try {
        await axios.post(graph(`${appConfig.META_CATALOG_ID}/items_batch`), null, {
          params: { access_token: appConfig.META_ACCESS_TOKEN, item_type: "PRODUCT_ITEM", requests: JSON.stringify(requests) },
          timeout: 30_000,
        });
        results.push(...batch.map((item) => ({ sku: item.sku, externalId: item.sku, error: null })));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push(...batch.map((item) => ({ sku: item.sku, error: message.slice(0, 300) })));
      }
    }
    return results;
  }

  // updateInventory => mismo endpoint con solo inventario/disponibilidad (RF-19.10 inventario unificado)
  public async updateInventory(items: Array<{ sku: string; available: number }>): Promise<void> {
    if (items.length === 0) return;
    const requests = items.map((item) => ({ method: "UPDATE", data: { id: item.sku, inventory: item.available, availability: item.available > 0 ? "in stock" : "out of stock" } }));
    await axios.post(graph(`${appConfig.META_CATALOG_ID}/items_batch`), null, {
      params: { access_token: appConfig.META_ACCESS_TOKEN, item_type: "PRODUCT_ITEM", requests: JSON.stringify(requests) },
      timeout: 15_000,
    });
  }

  // connectWhatsApp => RF-19.1 vincula el catálogo a la cuenta de WhatsApp Business (los clientes lo ven en el chat)
  public async connectWhatsApp(): Promise<boolean> {
    if (!this.configured || !appConfig.WHATSAPP_BUSINESS_ACCOUNT_ID) return false;
    await axios.post(graph(`${appConfig.WHATSAPP_BUSINESS_ACCOUNT_ID}/product_catalogs`), null, {
      params: { access_token: appConfig.WHATSAPP_TOKEN ?? appConfig.META_ACCESS_TOKEN, catalog_id: appConfig.META_CATALOG_ID },
      timeout: 15_000,
    });
    return true;
  }

  // fetchOrder => RF-19.3 checkout nativo de Meta (Commerce Platform): detalle del pedido + confirmación de recibido
  public async fetchOrder(externalId: string): Promise<ChannelOrder | null> {
    const auth = { access_token: appConfig.META_ACCESS_TOKEN };
    const { data } = await axios.get<{
      buyer_details?: { name?: string; email?: string; phone?: string };
      shipping_address?: { street1?: string; street2?: string; city?: string; state?: string; postal_code?: string; country?: string; name?: string };
      estimated_payment_details?: { shipping?: { amount?: string } };
    }>(graph(externalId), { params: { ...auth, fields: "buyer_details,shipping_address,estimated_payment_details" }, timeout: 15_000 });
    const { data: lines } = await axios.get<{ data: Array<{ retailer_id: string; quantity: number; price_per_unit: { amount: string } }> }>(graph(`${externalId}/items`), { params: auth, timeout: 15_000 });
    await axios.post(graph(`${externalId}/acknowledge_order`), null, { params: { ...auth, idempotency_key: externalId }, timeout: 15_000 }).catch(() => undefined);
    const [firstName = "Cliente", ...rest] = (data.buyer_details?.name ?? data.shipping_address?.name ?? "Cliente").split(" ");
    if (!data.buyer_details?.email) return null; // Sin correo no hay a quién notificar ni facturar
    return {
      externalId,
      email: data.buyer_details.email,
      firstName,
      lastName: rest.join(" ") || "-",
      phone: data.buyer_details.phone ?? "",
      address: {
        line1: data.shipping_address?.street1 ?? "",
        line2: data.shipping_address?.street2 ?? null,
        city: data.shipping_address?.city ?? "",
        state: data.shipping_address?.state ?? "",
        postalCode: data.shipping_address?.postal_code ?? "",
        country: data.shipping_address?.country ?? "CO",
      },
      items: lines.data.map((line) => ({ sku: line.retailer_id, quantity: line.quantity, unitPriceCents: Math.round(Number(line.price_per_unit.amount) * 100) })),
      shippingCents: Math.round(Number(data.estimated_payment_details?.shipping?.amount ?? 0) * 100),
    };
  }
}

// ---------- TikTok Shop ----------
const TIKTOK_API = "https://open-api.tiktokglobalshop.com";

// tiktokSign => firma oficial: HMAC-SHA256(secret, secret + path + params ordenados (clave+valor, sin sign ni
// access_token) + body + secret) en hexadecimal. Función PURA (testeable con valores fijos)
export function tiktokSign(path: string, params: Record<string, string>, body: string, secret: string): string {
  const sorted = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "access_token")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return createHmac("sha256", secret).update(`${secret}${path}${sorted}${body}${secret}`).digest("hex");
}

// verifyTikTokWebhook => header Authorization = HMAC-SHA256(app_secret, app_key + cuerpo crudo)
export function verifyTikTokWebhook(rawBody: string, signature: string | undefined): boolean {
  const { TIKTOK_SHOP_APP_KEY: key, TIKTOK_SHOP_APP_SECRET: secret } = appConfig;
  if (!key || !secret || !signature) return false;
  return createHmac("sha256", secret).update(`${key}${rawBody}`).digest("hex") === signature;
}

export class TikTokShopChannel implements CatalogChannelPort {
  public readonly channel = "TIKTOK_SHOP" as const;

  public get configured(): boolean {
    return Boolean(appConfig.TIKTOK_SHOP_APP_KEY && appConfig.TIKTOK_SHOP_APP_SECRET && appConfig.TIKTOK_SHOP_ACCESS_TOKEN && appConfig.TIKTOK_SHOP_CIPHER);
  }

  // request => agrega app_key, timestamp, shop_cipher y la firma; el token viaja en el header x-tts-access-token
  private async request<T>(method: "get" | "post", path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
    const params: Record<string, string> = { app_key: appConfig.TIKTOK_SHOP_APP_KEY ?? "", timestamp: String(Math.floor(Date.now() / 1000)), shop_cipher: appConfig.TIKTOK_SHOP_CIPHER ?? "", ...extra };
    const raw = body === undefined ? "" : JSON.stringify(body);
    params["sign"] = tiktokSign(path, params, raw, appConfig.TIKTOK_SHOP_APP_SECRET ?? "");
    const { data } = await axios.request<{ code: number; message: string; data: T }>({
      method,
      url: `${TIKTOK_API}${path}`,
      params,
      data: raw || undefined,
      headers: { "x-tts-access-token": appConfig.TIKTOK_SHOP_ACCESS_TOKEN ?? "", "content-type": "application/json" },
      timeout: 20_000,
    });
    if (data.code !== 0) throw new Error(`TikTok Shop ${data.code}: ${data.message}`);
    return data.data;
  }

  // uploadImage => TikTok exige subir la imagen a su CDN (multipart) y usar el "uri" que devuelve
  private async uploadImage(url: string): Promise<string> {
    const { data: bytes } = await axios.get<ArrayBuffer>(url, { responseType: "arraybuffer", timeout: 20_000 });
    const path = "/product/202309/images/upload";
    const params: Record<string, string> = { app_key: appConfig.TIKTOK_SHOP_APP_KEY ?? "", timestamp: String(Math.floor(Date.now() / 1000)) };
    params["sign"] = tiktokSign(path, params, "", appConfig.TIKTOK_SHOP_APP_SECRET ?? ""); // multipart: el cuerpo no se firma
    const form = new FormData(); // FormData/Blob nativos de Node 18+
    form.append("data", new Blob([bytes]), "image.jpg");
    form.append("use_case", "MAIN_IMAGE");
    const { data } = await axios.post<{ data: { uri: string } }>(`${TIKTOK_API}${path}`, form, { params, headers: { "x-tts-access-token": appConfig.TIKTOK_SHOP_ACCESS_TOKEN ?? "" }, timeout: 30_000 });
    return data.data.uri;
  }

  // upsert => productos nuevos se crean (una ficha por producto con sus SKU); los ya publicados solo actualizan precio
  // e inventario. Requiere la categoría de TikTok del catálogo (TIKTOK_SHOP_CATEGORY_ID)
  public async upsert(items: CatalogItem[], known: Map<string, { externalId: string | null; externalSkuId: string | null }>): Promise<SyncResult[]> {
    const byProduct = new Map<string, CatalogItem[]>();
    for (const item of items) byProduct.set(item.productId, [...(byProduct.get(item.productId) ?? []), item]);
    const results: SyncResult[] = [];
    for (const variants of byProduct.values()) {
      const first = variants[0]!;
      try {
        const existing = known.get(first.sku);
        if (existing?.externalId) {
          await this.request("post", `/product/202309/products/${existing.externalId}/prices/update`, {
            skus: variants.filter((v) => known.get(v.sku)?.externalSkuId).map((v) => ({ id: known.get(v.sku)!.externalSkuId, price: { amount: (v.priceCents / 100).toFixed(2), currency: v.currency } })),
          });
          await this.updateInventory(variants.map((v) => ({ sku: v.sku, available: v.available, ...(known.get(v.sku) ?? { externalId: null, externalSkuId: null }) })));
          results.push(...variants.map((v) => ({ sku: v.sku, ...(known.get(v.sku) ?? {}), error: null })));
          continue;
        }
        if (!appConfig.TIKTOK_SHOP_CATEGORY_ID) throw new Error("Falta TIKTOK_SHOP_CATEGORY_ID");
        const uri = first.imageUrl ? await this.uploadImage(first.imageUrl) : null;
        const created = await this.request<{ product_id: string; skus: Array<{ id: string; seller_sku: string }> }>("post", "/product/202309/products", {
          title: first.title.slice(0, 255),
          description: first.description.slice(0, 10_000) || first.title,
          category_id: appConfig.TIKTOK_SHOP_CATEGORY_ID,
          main_images: uri ? [{ uri }] : [],
          skus: variants.map((v) => ({
            seller_sku: v.sku,
            price: { amount: (v.priceCents / 100).toFixed(2), currency: v.currency },
            inventory: [{ warehouse_id: appConfig.TIKTOK_SHOP_WAREHOUSE_ID ?? "", quantity: v.available }],
          })),
        });
        const skuIds = new Map(created.skus.map((sku) => [sku.seller_sku, sku.id]));
        results.push(...variants.map((v) => ({ sku: v.sku, externalId: created.product_id, externalSkuId: skuIds.get(v.sku) ?? null, error: null })));
      } catch (error) {
        results.push(...variants.map((v) => ({ sku: v.sku, error: (error instanceof Error ? error.message : String(error)).slice(0, 300) })));
      }
    }
    return results;
  }

  public async updateInventory(items: Array<{ sku: string; available: number; externalId: string | null; externalSkuId: string | null }>): Promise<void> {
    const byProduct = new Map<string, typeof items>();
    for (const item of items.filter((i) => i.externalId && i.externalSkuId)) byProduct.set(item.externalId!, [...(byProduct.get(item.externalId!) ?? []), item]);
    for (const [productId, skus] of byProduct) {
      await this.request("post", `/product/202309/products/${productId}/inventory/update`, {
        skus: skus.map((sku) => ({ id: sku.externalSkuId, inventory: [{ warehouse_id: appConfig.TIKTOK_SHOP_WAREHOUSE_ID ?? "", quantity: sku.available }] })),
      });
    }
  }

  // fetchOrder => RF-19.3 pedido pagado dentro de TikTok (cada línea = 1 unidad: se agrupan por SKU)
  public async fetchOrder(externalId: string): Promise<ChannelOrder | null> {
    const data = await this.request<{
      orders: Array<{
        id: string;
        buyer_email: string;
        recipient_address: { name: string; phone_number: string; address_line1: string; address_line2?: string; postal_code: string; region_code: string; district_info?: Array<{ address_level_name: string; address_name: string }> };
        line_items: Array<{ seller_sku: string; sale_price: string }>;
        payment: { shipping_fee?: string };
      }>;
    }>("get", "/order/202309/orders", undefined, { ids: externalId });
    const order = data.orders[0];
    if (!order) return null;
    const grouped = new Map<string, { sku: string; quantity: number; unitPriceCents: number }>();
    for (const line of order.line_items) {
      const current = grouped.get(line.seller_sku);
      grouped.set(line.seller_sku, { sku: line.seller_sku, quantity: (current?.quantity ?? 0) + 1, unitPriceCents: Math.round(Number(line.sale_price) * 100) });
    }
    const district = (level: string) => order.recipient_address.district_info?.find((d) => d.address_level_name.toLowerCase().includes(level))?.address_name ?? "";
    const [firstName = "Cliente", ...rest] = order.recipient_address.name.split(" ");
    return {
      externalId: order.id,
      email: order.buyer_email,
      firstName,
      lastName: rest.join(" ") || "-",
      phone: order.recipient_address.phone_number,
      address: { line1: order.recipient_address.address_line1, line2: order.recipient_address.address_line2 ?? null, city: district("city"), state: district("state") || district("province"), postalCode: order.recipient_address.postal_code, country: order.recipient_address.region_code },
      items: [...grouped.values()],
      shippingCents: Math.round(Number(order.payment.shipping_fee ?? 0) * 100),
    };
  }
}

export const catalogChannels: CatalogChannelPort[] = [new MetaCatalogChannel(), new TikTokShopChannel()];
export const metaCatalog = catalogChannels[0] as MetaCatalogChannel;
