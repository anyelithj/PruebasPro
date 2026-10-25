// retention.service.ts (Express · Prisma · PostgreSQL) => retención de clientes:
//  - RF-18.8 riesgo de abandono (churn) por cliente: días sin comprar frente a SU ritmo habitual de compra
//  - RF-18.8 / RF-20.8 reactivación automática de inactivos: cupón personal + aviso por correo, push y WhatsApp
//  - RF-16.3 ofertas personalizadas: un producto en rebaja de las categorías que el cliente ya compra
// Patrones: Service Layer + Query Object (SQL parametrizado con Prisma.sql: sin inyección) + Idempotencia (cada job se
// puede repetir sin duplicar envíos: la deduplicación vive en la base, no en memoria).
// Paradigma: funcional (clasificación pura) + asíncrono. GDPR: solo se contacta a quien aceptó marketing.
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { redis } from "../../../config/redis.config";
import { notificationService } from "../../notification/service/notification.service";
import { createPersonalCoupon } from "../../coupon/service/coupon.service";
import { automationService } from "../../automation/service/automation.service"; // RF-20.8 flujos de reactivación

import { classifyChurn, type ChurnRisk } from "../model/insight.model"; // Regla pura compartida (sin ciclos de imports)
export { classifyChurn, type ChurnRisk };
export interface ChurnRow {
  userId: string;
  name: string;
  email: string;
  orders: number;
  daysSinceLastOrder: number;
  avgIntervalDays: number;
  ratio: number; // Días sin comprar / intervalo habitual (1 = le toca comprar)
  risk: ChurnRisk;
}

const REACTIVATION = { percent: 15, validDays: 14, cooldownDays: 60 } as const; // "as const" => valores literales de solo lectura
const MIN_INTERVAL_DAYS = 30; // Un cliente con una sola compra se compara contra 30 días


export class RetentionService {
  // churnRisk => clientes con compras ordenados por riesgo. "intervalo habitual" = (última - primera) / (pedidos - 1)
  public async churnRisk(limit = 100, minRisk: ChurnRisk = "MEDIUM"): Promise<ChurnRow[]> {
    const minimum = minRisk === "HIGH" ? 3 : minRisk === "MEDIUM" ? 1.5 : 0;
    // CTE "s" => agregados por cliente; el ratio se calcula y filtra EN la base (solo viajan las filas útiles)
    const rows = await prisma.$queryRaw<Array<{ userId: string; name: string; email: string; orders: number; days: number; interval: number }>>(Prisma.sql`
      WITH s AS (
        SELECT u.id AS "userId", u."firstName" || ' ' || u."lastName" AS name, u.email,
          COUNT(o.id)::int AS orders,
          (EXTRACT(EPOCH FROM NOW() - MAX(o."placedAt")) / 86400)::int AS days,
          GREATEST(${MIN_INTERVAL_DAYS}, CASE WHEN COUNT(o.id) > 1
            THEN EXTRACT(EPOCH FROM MAX(o."placedAt") - MIN(o."placedAt")) / 86400 / (COUNT(o.id) - 1) ELSE 0 END)::int AS interval
        FROM users u JOIN orders o ON o."userId" = u.id AND o.status <> 'CANCELLED'
        WHERE u."deletedAt" IS NULL AND u."isActive" = true
        GROUP BY u.id
      )
      SELECT * FROM s WHERE days::numeric / interval >= ${minimum}
      ORDER BY days::numeric / interval DESC
      LIMIT ${limit}`);
    return rows
      .map((row) => {
        const ratio = Math.round((row.days / row.interval) * 100) / 100;
        return { userId: row.userId, name: row.name, email: row.email, orders: row.orders, daysSinceLastOrder: row.days, avgIntervalDays: row.interval, ratio, risk: classifyChurn(ratio) };
      });
  }

  // reactivate => job diario: riesgo ALTO + opt-in de marketing + sin cupón de reactivación en los últimos 60 días
  // (la deduplicación usa la tabla de cupones: durable y sin Redis). Devuelve cuántos clientes se contactaron.
  public async reactivate(batch = 50): Promise<number> {
    const candidates = (await this.churnRisk(batch * 2, "HIGH")).map((row) => row.userId);
    if (candidates.length === 0) return 0;
    const eligible = await prisma.$queryRaw<Array<{ id: string; firstName: string }>>(Prisma.sql`
      SELECT u.id, u."firstName" FROM users u
      JOIN notification_preferences p ON p."userId" = u.id AND p.marketing = true
      WHERE u.id = ANY(${candidates}::text[])
        AND NOT EXISTS (SELECT 1 FROM coupons c WHERE c.origin = 'REACTIVATION' AND u.id = ANY(c."userIds")
                        AND c."createdAt" >= NOW() - make_interval(days => ${REACTIVATION.cooldownDays}::int))
      LIMIT ${batch}`);
    for (const user of eligible) {
      const code = await createPersonalCoupon({ userId: user.id, origin: "REACTIVATION", type: "PERCENTAGE", value: REACTIVATION.percent, validDays: REACTIVATION.validDays, description: "Reactivación de cliente inactivo" });
      await notificationService.notify(user.id, { type: "PROMOTION", message: { key: "customerReactivation", params: { firstName: user.firstName, code, percent: REACTIVATION.percent } }, url: "/" });
      // RF-20.8 evento para los flujos de n8n (correo personalizado, WhatsApp, CRM...)
      await automationService.trigger("customer.inactive", { userId: user.id, firstName: user.firstName, code, percent: REACTIVATION.percent }).catch(() => undefined);
    }
    return eligible.length;
  }

  // personalizedOffers => job semanal: por cliente con opt-in, el producto en rebaja con MAYOR descuento de las
  // categorías que ya compró y que aún no tiene ("DISTINCT ON" => una fila por cliente en una sola consulta)
  public async personalizedOffers(batch = 200): Promise<number> {
    const offers = await prisma.$queryRaw<Array<{ userId: string; productName: string; slug: string; percent: number }>>(Prisma.sql`
      WITH bought AS (
        SELECT DISTINCT o."userId", p."categoryId", oi."productId"
        FROM orders o JOIN order_items oi ON oi."orderId" = o.id JOIN products p ON p.id = oi."productId"
        WHERE o."placedAt" >= NOW() - INTERVAL '365 days' AND p."categoryId" IS NOT NULL
      ), deals AS (
        SELECT p.id, p.name, p.slug, p."categoryId",
          MAX(ROUND((1 - v."priceCents"::numeric / v."compareAtPriceCents") * 100))::int AS percent
        FROM products p JOIN product_variants v ON v."productId" = p.id AND v."isActive" = true
        WHERE p.status = 'ACTIVE' AND v."compareAtPriceCents" > v."priceCents"
        GROUP BY p.id
      )
      SELECT DISTINCT ON (b."userId") b."userId", d.name AS "productName", d.slug, d.percent
      FROM bought b
      JOIN notification_preferences np ON np."userId" = b."userId" AND np.marketing = true
      JOIN deals d ON d."categoryId" = b."categoryId"
      WHERE NOT EXISTS (SELECT 1 FROM bought x WHERE x."userId" = b."userId" AND x."productId" = d.id)
      ORDER BY b."userId", d.percent DESC
      LIMIT ${batch}`);
    let sent = 0;
    for (const offer of offers) {
      // Una oferta por cliente por semana (SET NX EX); sin Redis no se envía (evita repetir en cada ejecución)
      const first = await redis.set(`offer:weekly:${offer.userId}`, "1", "EX", 7 * 24 * 3600, "NX").catch(() => null);
      if (first !== "OK") continue;
      await notificationService.notify(offer.userId, { type: "PROMOTION", message: { key: "personalizedOffer", params: { productName: offer.productName, percent: offer.percent } }, url: `/products/${offer.slug}` });
      sent += 1;
    }
    return sent;
  }
}

export const retentionService = new RetentionService();
