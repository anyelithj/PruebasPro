// channel.service.ts => comercio multicanal (RF 19):
//  - RF-19.1 / RF-19.7 sincroniza el catálogo con Meta (Facebook Shop, Instagram, Marketplace y WhatsApp) y TikTok Shop
//  - RF-19.10 inventario ÚNICO: cada ajuste de stock se empuja a los canales (debounce de 30 s por lotes)
//  - RF-19.3 / RF-19.10 importa los pedidos pagados en el checkout nativo de cada red como pedidos normales de la
//    tienda (mismo modelo, misma bodega, misma facturación): un solo flujo de pedidos para todos los canales
// Patrones: Facade (un método por caso de uso), Strategy (CatalogChannelPort por canal), Observer (eventos de
// inventario) e Idempotencia (el id externo del pedido se guarda en channelRef: un webhook repetido no duplica).
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { logger } from "../../../shared/middleware/logger.middleware";
import { computeTotals } from "../../checkout/model/checkout.model";
import type { CheckoutItemSnapshot } from "../../checkout/schema/checkout.schema";
import { orderRepository } from "../../order/repository/order.repository";
import { orderService, toPayload } from "../../order/service/order.service";
import { commerceEvents } from "../../order/event/order.event";
import { inventoryEvents } from "../../inventory/event/inventory.event";
import { ChannelListingModel, type CatalogChannel } from "../model/channel.model";
import { catalogChannels, metaCatalog, type CatalogItem, type ChannelOrder } from "../provider/catalog.provider";

const INVENTORY_DEBOUNCE_MS = 30_000; // Agrupa los ajustes de stock: una llamada por canal cada 30 s como máximo

// storeLink => ficha del producto en la tienda (Nuxt) con UTM: las ventas desde la red quedan atribuidas
const storeLink = (slug: string, channel: CatalogChannel) => `${appConfig.STORE_URL}/products/${slug}?utm_source=${channel.toLowerCase()}&utm_medium=social`;

export class ChannelService {
  private pending = new Set<string>(); // Variantes con stock cambiado aún no enviado
  private timer: NodeJS.Timeout | null = null;

  // status => qué canales están configurados y cuántas SKU tienen publicadas / con error
  public async status(): Promise<Array<{ channel: CatalogChannel; configured: boolean; listed: number; errors: number; lastSync: Date | null }>> {
    return Promise.all(
      catalogChannels.map(async (port) => {
        const [listed, errors, last] = await Promise.all([
          ChannelListingModel.countDocuments({ channel: port.channel, error: null, syncedAt: { $ne: null } }),
          ChannelListingModel.countDocuments({ channel: port.channel, error: { $ne: null } }),
          ChannelListingModel.findOne({ channel: port.channel }).sort({ syncedAt: -1 }).select({ syncedAt: 1 }).lean(),
        ]);
        return { channel: port.channel, configured: port.configured, listed, errors, lastSync: last?.syncedAt ?? null };
      })
    );
  }

  // catalogItems => variantes activas de productos ACTIVOS con su stock disponible (una sola consulta con include)
  private async catalogItems(channel: CatalogChannel, variantIds?: string[]): Promise<CatalogItem[]> {
    const variants = await prisma.productVariant.findMany({
      where: { isActive: true, product: { status: "ACTIVE" }, ...(variantIds ? { id: { in: variantIds } } : {}) },
      include: { product: { select: { name: true, slug: true, description: true, brand: { select: { name: true } }, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } } },
    });
    return variants.map((variant) => ({
      productId: variant.productId,
      variantId: variant.id,
      sku: variant.sku,
      title: variant.name && variant.name !== "Default" ? `${variant.product.name} - ${variant.name}` : variant.product.name,
      description: variant.product.description,
      priceCents: variant.priceCents,
      compareAtPriceCents: variant.compareAtPriceCents,
      currency: appConfig.DEFAULT_CURRENCY,
      available: Math.max(0, variant.stock - variant.reservedStock),
      imageUrl: variant.product.images[0]?.url ?? null,
      link: storeLink(variant.product.slug, channel),
      brand: variant.product.brand?.name ?? null,
    }));
  }

  // syncCatalog => publica/actualiza todo el catálogo en los canales pedidos (o en todos los configurados)
  public async syncCatalog(channels?: CatalogChannel[]): Promise<Array<{ channel: CatalogChannel; synced: number; failed: number }>> {
    const summary: Array<{ channel: CatalogChannel; synced: number; failed: number }> = [];
    for (const port of catalogChannels.filter((p) => p.configured && (!channels || channels.includes(p.channel)))) {
      const items = await this.catalogItems(port.channel);
      const known = new Map((await ChannelListingModel.find({ channel: port.channel }).lean()).map((row) => [row.sku, { externalId: row.externalId ?? null, externalSkuId: row.externalSkuId ?? null }]));
      const results = await port.upsert(items, known);
      const bySku = new Map(items.map((item) => [item.sku, item]));
      // bulkWrite con upsert => una ida a MongoDB para todo el lote
      await ChannelListingModel.bulkWrite(
        results.map((result) => ({
          updateOne: {
            filter: { channel: port.channel, sku: result.sku },
            update: {
              $set: {
                productId: bySku.get(result.sku)?.productId ?? "",
                variantId: bySku.get(result.sku)?.variantId ?? null,
                error: result.error ?? null,
                ...(result.error ? {} : { syncedAt: new Date() }),
                ...(result.externalId !== undefined ? { externalId: result.externalId } : {}),
                ...(result.externalSkuId !== undefined ? { externalSkuId: result.externalSkuId } : {}),
              },
            },
            upsert: true,
          },
        }))
      );
      if (port.channel === "META") await metaCatalog.connectWhatsApp().catch((error: unknown) => logger.warn("whatsapp_catalog_connect_failed", { error: String(error) }));
      summary.push({ channel: port.channel, synced: results.filter((r) => !r.error).length, failed: results.filter((r) => r.error).length });
    }
    return summary;
  }

  // registerSubscribers => RF-19.10 cada ajuste de inventario se acumula y se envía en lote a los canales
  public registerSubscribers(): void {
    inventoryEvents.on("inventory.adjusted", (level) => this.queueInventory(level.variantId));
    // Una venta en CUALQUIER canal descuenta el stock único => se refleja en los demás canales
    commerceEvents.on("order.placed", async (event) => {
      if (!catalogChannels.some((port) => port.configured)) return;
      const items = await prisma.orderItem.findMany({ where: { orderId: event.orderId }, select: { variantId: true } });
      items.forEach((item) => item.variantId && this.queueInventory(item.variantId));
    });
  }

  private queueInventory(variantId: string): void {
    if (!catalogChannels.some((port) => port.configured)) return;
    this.pending.add(variantId);
    this.timer ??= setTimeout(() => void this.flushInventory(), INVENTORY_DEBOUNCE_MS);
  }

  private async flushInventory(): Promise<void> {
    const ids = [...this.pending];
    this.pending.clear();
    this.timer = null;
    for (const port of catalogChannels.filter((p) => p.configured)) {
      try {
        const items = await this.catalogItems(port.channel, ids);
        const listings = new Map((await ChannelListingModel.find({ channel: port.channel, sku: { $in: items.map((i) => i.sku) } }).lean()).map((row) => [row.sku, row]));
        await port.updateInventory(items.filter((item) => listings.has(item.sku)).map((item) => ({ sku: item.sku, available: item.available, externalId: listings.get(item.sku)?.externalId ?? null, externalSkuId: listings.get(item.sku)?.externalSkuId ?? null })));
      } catch (error) {
        logger.warn("channel_inventory_push_failed", { channel: port.channel, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  // importOrder => RF-19.3 pedido del checkout nativo de una red -> pedido de la tienda (idempotente por channelRef)
  public async importOrder(channel: CatalogChannel, order: ChannelOrder): Promise<string | null> {
    const channelRef = `${channel}:${order.externalId}`.slice(0, 120);
    const existing = await prisma.order.findFirst({ where: { channelRef }, select: { id: true } });
    if (existing) return existing.id;
    // Comprador: cuenta existente por correo o cuenta de invitado (RF-08.1) para notificar, facturar y devolver
    const user =
      (await prisma.user.findUnique({ where: { email: order.email.toLowerCase() }, select: { id: true } })) ??
      (await prisma.user.create({ data: { email: order.email.toLowerCase(), firstName: order.firstName, lastName: order.lastName, isGuest: true }, select: { id: true } }));
    const variants = await prisma.productVariant.findMany({
      where: { sku: { in: order.items.map((item) => item.sku) } },
      include: { product: { select: { name: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } } },
    });
    const bySku = new Map(variants.map((variant) => [variant.sku, variant]));
    const items: CheckoutItemSnapshot[] = order.items
      .filter((item) => bySku.has(item.sku))
      .map((item) => {
        const variant = bySku.get(item.sku)!;
        return { variantId: variant.id, productId: variant.productId, productName: variant.product.name, variantName: variant.name, sku: item.sku, imageUrl: variant.product.images[0]?.url ?? null, unitPriceCents: item.unitPriceCents, quantity: item.quantity, weightGrams: variant.weightGrams };
      });
    if (items.length === 0) {
      logger.warn("channel_order_without_known_skus", { channel, externalId: order.externalId });
      return null;
    }
    const subtotalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
    const orderId = await orderRepository.createManual({
      userId: user.id,
      items,
      totals: computeTotals({ subtotalCents, discountCents: 0, shippingCents: order.shippingCents, taxRate: appConfig.TAX_RATE }),
      currency: appConfig.DEFAULT_CURRENCY,
      shippingAddress: { recipientName: `${order.firstName} ${order.lastName}`.trim(), phone: order.phone, ...order.address },
      note: `Pedido pagado en ${channel === "META" ? "Facebook/Instagram" : "TikTok Shop"} (${order.externalId})`,
      changedById: null,
      channel: "SOCIAL",
      channelRef,
      paymentRef: channelRef,
    });
    const detail = await orderService.getOrderById(orderId, { id: user.id, roles: ["ADMIN"] });
    commerceEvents.emit("order.placed", toPayload(detail)); // Envío, factura, puntos y avisos
    return orderId;
  }

  // ---------- Webhooks (cuerpo crudo: la firma se calcula sobre los bytes exactos) ----------
  // verifyMeta => X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, cuerpo) (comparación en tiempo constante)
  public verifyMeta(raw: Buffer, signature: string | undefined): boolean {
    if (!appConfig.FACEBOOK_APP_SECRET || !signature?.startsWith("sha256=")) return false;
    const expected = Buffer.from(`sha256=${createHmac("sha256", appConfig.FACEBOOK_APP_SECRET).update(raw).digest("hex")}`);
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  // handleMetaWebhook => cambios "commerce_orders": cada pedido nuevo se trae por la Graph API y se importa
  public async handleMetaWebhook(payload: { entry?: Array<{ changes?: Array<{ field?: string; value?: { order_id?: string; id?: string; event?: string } }> }> }): Promise<number> {
    let imported = 0;
    for (const change of payload.entry?.flatMap((entry) => entry.changes ?? []) ?? []) {
      const orderId = change.value?.order_id ?? change.value?.id;
      if (change.field !== "commerce_orders" || !orderId) continue;
      const order = await metaCatalog.fetchOrder(orderId);
      if (order && (await this.importOrder("META", order))) imported += 1;
    }
    return imported;
  }

  // handleTikTokWebhook => tipo 1 (cambio de estado del pedido): al quedar pagado ("AWAITING_SHIPMENT") se importa
  public async handleTikTokWebhook(payload: { type?: number; data?: { order_id?: string; order_status?: string } }): Promise<boolean> {
    if (payload.type !== 1 || payload.data?.order_status !== "AWAITING_SHIPMENT" || !payload.data.order_id) return false;
    const port = catalogChannels.find((p) => p.channel === "TIKTOK_SHOP")!;
    const order = await port.fetchOrder(payload.data.order_id);
    return Boolean(order && (await this.importOrder("TIKTOK_SHOP", order)));
  }
}

export const channelService = new ChannelService();
