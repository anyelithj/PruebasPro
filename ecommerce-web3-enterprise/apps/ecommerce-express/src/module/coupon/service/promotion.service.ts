// promotion.service.ts => casos de uso de las promociones automáticas (RF-13.4/13.7/13.8/13.9/13.10): CRUD del panel,
// ofertas flash públicas (contador regresivo en la tienda), cálculo en el checkout, historial por pedido y campañas
// preconfiguradas de Black Friday / Cyber Monday. Patrones: Facade (el checkout llama a "applyTo" sin conocer reglas ni
// catálogo) + Observer (historial al colocarse el pedido) + Cache-Aside (reglas vigentes 60 s).
import type { Prisma, Promotion } from "@prisma/client";
import { applyPromotions, seasonalDates, type AppliedPromotion, type PromotionLine, type PromotionRule } from "../model/promotion.model";
import type { PromotionInput, UpdatePromotionInput } from "../schema/promotion.schema";
import { commerceEvents } from "../../order/event/order.event";
import { prisma } from "../../../config/database.config";
import { RedisKeys } from "../../../config/redis.config";
import { cached, invalidatePattern } from "../../../shared/interceptor/cache.interceptor";
import { NotFoundException } from "../../../shared/filter/http-exception.filter";
import { logger } from "../../../shared/middleware/logger.middleware";

const ACTIVE_TTL_SECONDS = 60;
const activeKey = () => RedisKeys.catalog("promotions", "active");

// toRule => fila de Prisma -> regla del motor (tiers Json validado por forma)
function toRule(row: Promotion): PromotionRule {
  const tiers = Array.isArray(row.tiers) ? (row.tiers as Array<{ minQty: number; percent: number }>) : null;
  return { ...row, tiers };
}

export class PromotionService {
  // active => reglas vigentes ahora (cache 60 s: el checkout las consulta en cada paso)
  public active(): Promise<Promotion[]> {
    return cached(activeKey(), ACTIVE_TTL_SECONDS, () => {
      const now = new Date();
      return prisma.promotion.findMany({ where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } }, orderBy: { priority: "desc" } });
    });
  }

  // flash => RF-13.8 ofertas flash vigentes (o de un producto) con su fin para el contador regresivo de la tienda
  public async flash(productId?: string): Promise<Array<{ id: string; name: string; percent: number | null; endsAt: Date; productIds: string[] }>> {
    const rows = (await this.active()).filter((row) => row.type === "FLASH" && (!productId || row.productIds.length === 0 || row.productIds.includes(productId)));
    return rows.map(({ id, name, percent, endsAt, productIds }) => ({ id, name, percent, endsAt: new Date(endsAt), productIds }));
  }

  // applyTo => descuento automático de un conjunto de ítems (los datos de catálogo se leen en UNA consulta)
  public async applyTo(items: Array<{ variantId: string; productId: string; unitPriceCents: number; quantity: number }>): Promise<{ discountCents: number; applied: AppliedPromotion[] }> {
    const rules = await this.active();
    if (rules.length === 0 || items.length === 0) return { discountCents: 0, applied: [] };
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(items.map((item) => item.productId))] } },
      select: { id: true, categoryId: true, brandId: true, collections: { select: { collectionId: true } } },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const lines: PromotionLine[] = items.map((item) => {
      const product = byId.get(item.productId);
      return { ...item, categoryId: product?.categoryId ?? null, brandId: product?.brandId ?? null, collectionIds: product?.collections.map((entry) => entry.collectionId) ?? [] };
    });
    return applyPromotions(lines, rules.map((row) => toRule({ ...row, startsAt: new Date(row.startsAt), endsAt: new Date(row.endsAt) })));
  }

  // --- CRUD del panel ---
  public list(): Promise<Promotion[]> {
    return prisma.promotion.findMany({ orderBy: [{ isActive: "desc" }, { startsAt: "desc" }] });
  }

  public async create(input: PromotionInput): Promise<Promotion> {
    const { buyQuantity, payQuantity, percent, tiers, campaign, ...rest } = input;
    // "?? null" => los campos opcionales viajan como null (exactOptionalPropertyTypes no admite undefined en Prisma)
    const row = await prisma.promotion.create({
      data: { ...rest, buyQuantity: buyQuantity ?? null, payQuantity: payQuantity ?? null, percent: percent ?? null, campaign: campaign ?? null, ...(tiers ? { tiers: tiers as Prisma.InputJsonValue } : {}) },
    });
    await invalidatePattern(activeKey());
    return row;
  }

  public async update(id: string, input: UpdatePromotionInput): Promise<Promotion> {
    if (!(await prisma.promotion.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException("Promotion", id);
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Prisma.PromotionUpdateInput;
    const row = await prisma.promotion.update({ where: { id }, data: changes });
    await invalidatePattern(activeKey());
    return row;
  }

  // history => RF-13.10 promociones aplicadas (por pedido o las últimas del negocio) con su ahorro
  public history(orderId?: string) {
    return prisma.promotionApplication.findMany({
      where: orderId ? { orderId } : {},
      include: { promotion: { select: { name: true, type: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  // ensureSeasonalCampaigns => RF-13.9 campañas preconfiguradas del año: Black Friday (20 %) y Cyber Monday (15 %)
  // sobre todo el catálogo, prioridad alta y NO combinables. Idempotente (no duplica si ya existen); el ADMIN puede
  // editarlas o desactivarlas. Lo ejecuta un job diario desde el 1 de noviembre y también se puede llamar a mano
  public async ensureSeasonalCampaigns(year = new Date().getUTCFullYear()): Promise<number> {
    const { blackFriday, cyberMonday } = seasonalDates(year);
    const presets = [
      { campaign: `BLACK_FRIDAY_${year}`, name: `Black Friday ${year}`, percent: 20, ...blackFriday },
      { campaign: `CYBER_MONDAY_${year}`, name: `Cyber Monday ${year}`, percent: 15, ...cyberMonday },
    ];
    let created = 0;
    for (const preset of presets) {
      if (await prisma.promotion.findFirst({ where: { campaign: preset.campaign }, select: { id: true } })) continue;
      await prisma.promotion.create({ data: { ...preset, type: "PERCENT_OFF", priority: 100, stackable: false } });
      created += 1;
    }
    if (created > 0) {
      await invalidatePattern(activeKey());
      logger.info("seasonal_campaigns_created", { year, created });
    }
    return created;
  }

  // registerSubscribers => RF-13.10 historial: al colocarse el pedido se registran las promociones del checkout
  public registerSubscribers(): void {
    commerceEvents.on("order.placed", async (event) => {
      const order = await prisma.order.findUnique({ where: { id: event.orderId }, select: { checkoutSession: { select: { promotions: true } } } });
      const applied = (order?.checkoutSession.promotions as AppliedPromotion[] | null) ?? [];
      if (applied.length === 0) return;
      await prisma.promotionApplication.createMany({
        data: applied.map((entry) => ({ promotionId: entry.promotionId, orderId: event.orderId, discountCents: entry.discountCents })),
        skipDuplicates: true, // Idempotente ante eventos repetidos (@@unique promotionId + orderId)
      });
    });
  }
}

export const promotionService = new PromotionService();
