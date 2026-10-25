// insight.service.ts => CRM avanzado (Prisma/PostgreSQL + MongoDB):
//  - RF-22.2 segmentos personalizados por reglas (vista previa, CRUD y audiencia de campañas)
//  - RF-22.4 detección y fusión de clientes duplicados + importación desde CSV
//  - RF-22.6 clientes de alto valor (CLV a 12 meses) con su riesgo de abandono
//  - RF-22.7 / RF-24.2 retención por cohortes del mes de primera compra
//  - RF-22.8 siguiente mejor acción · RF-22.10 venta de mayor valor (upsell) y anomalías por cliente
// Patrones: Facade + Interpreter (reglas -> SQL parametrizado) + Unit of Work (fusión en una transacción).
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { statsQuery, toStats, type StatsRow } from "../repository/crm.repository";
import { CrmProfileModel } from "../model/crm.model";
import { authRepository } from "../../auth/repository/auth.repository";
import type { AudienceMember } from "../dto/crm.dto";
import { CustomSegmentModel, classifyChurn, cohortMatrix, detectAnomalies, nextBestAction, parseCustomerCsv, projectedClv, type SegmentRules } from "../model/insight.model";

const DAY = 86_400_000;

// rulesSql => Interpreter: cada regla definida se traduce a una condición parametrizada sobre la CTE "seg"
function rulesSql(rules: SegmentRules): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (rules.minOrders !== undefined) conditions.push(Prisma.sql`orders >= ${rules.minOrders}`);
  if (rules.maxOrders !== undefined) conditions.push(Prisma.sql`orders <= ${rules.maxOrders}`);
  if (rules.minLtvCents !== undefined) conditions.push(Prisma.sql`"ltvCents" >= ${rules.minLtvCents}`);
  if (rules.maxLtvCents !== undefined) conditions.push(Prisma.sql`"ltvCents" <= ${rules.maxLtvCents}`);
  if (rules.lastOrderWithinDays) conditions.push(Prisma.sql`"lastOrderAt" >= NOW() - make_interval(days => ${rules.lastOrderWithinDays}::int)`);
  if (rules.noOrderForDays) conditions.push(Prisma.sql`COALESCE("lastOrderAt", "createdAt") < NOW() - make_interval(days => ${rules.noOrderForDays}::int)`);
  if (rules.registeredWithinDays) conditions.push(Prisma.sql`"createdAt" >= NOW() - make_interval(days => ${rules.registeredWithinDays}::int)`);
  if (rules.city) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM orders oc WHERE oc."userId" = seg.id AND lower(oc."shippingAddress"->>'city') = lower(${rules.city}))`);
  return Prisma.join(conditions, " AND ");
}

export class InsightService {
  // ---------- RF-22.2 segmentos personalizados ----------
  public async segmentMembers(rules: SegmentRules, options: { consent?: boolean; limit?: number } = {}) {
    const includeIds = rules.tags?.length ? (await CrmProfileModel.find({ tags: { $all: rules.tags } }).select({ userId: 1 }).lean()).map((p) => p.userId) : undefined;
    if (includeIds && includeIds.length === 0) return [];
    const archived = (await CrmProfileModel.find({ archivedAt: { $ne: null } }).select({ userId: 1 }).lean()).map((p) => p.userId);
    const consent = options.consent ? Prisma.sql`JOIN notification_preferences np ON np."userId" = u.id AND np.marketing = true` : Prisma.empty;
    const rows = await prisma.$queryRaw<StatsRow[]>`
      ${statsQuery({ includeIds, excludeIds: archived }, consent)}
      SELECT * FROM seg WHERE ${rulesSql(rules)} ORDER BY "ltvCents" DESC LIMIT ${options.limit ?? 10_000}`;
    return rows.map(toStats);
  }

  public async previewSegment(rules: SegmentRules) {
    const members = await this.segmentMembers(rules, { limit: 5000 });
    return { count: members.length, sample: members.slice(0, 10) };
  }

  public async segments() {
    return (await CustomSegmentModel.find().sort({ name: 1 }).lean()).map(({ _id, ...row }) => ({ id: String(_id), ...row }));
  }

  public async createSegment(input: { name: string; description?: string | undefined; rules: SegmentRules }, userId: string) {
    const doc = await CustomSegmentModel.create({ ...input, description: input.description ?? null, createdBy: userId });
    return { id: String(doc._id), ...input };
  }

  public async updateSegment(id: string, input: { name?: string | undefined; description?: string | undefined; rules?: SegmentRules | undefined }) {
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    const doc = await CustomSegmentModel.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
    if (!doc) throw new NotFoundException("CustomSegment", id);
    const { _id, ...row } = doc;
    return { id: String(_id), ...row };
  }

  public async deleteSegment(id: string): Promise<void> {
    await CustomSegmentModel.deleteOne({ _id: id });
  }

  // audience => la usa Marketing con audiencia "SEGMENT:<id>" (solo con opt-in de marketing: GDPR)
  public async audience(segmentId: string): Promise<AudienceMember[]> {
    const segment = await CustomSegmentModel.findById(segmentId).lean();
    if (!segment) throw new NotFoundException("CustomSegment", segmentId);
    return (await this.segmentMembers(segment.rules as SegmentRules, { consent: true })).map((m) => ({ userId: m.id, email: m.email, firstName: m.firstName, lastName: m.lastName, phone: m.phone }));
  }

  // ---------- RF-22.7 / RF-24.2 cohortes ----------
  public async cohorts(months = 12) {
    const rows = await prisma.$queryRaw<Array<{ cohort: string; offset: number; customers: number }>>(Prisma.sql`
      WITH firsts AS (
        SELECT "userId", date_trunc('month', MIN("placedAt")) AS first FROM orders WHERE status <> 'CANCELLED' GROUP BY "userId"
      )
      SELECT to_char(f.first, 'YYYY-MM') AS cohort,
        ((EXTRACT(YEAR FROM date_trunc('month', o."placedAt")) - EXTRACT(YEAR FROM f.first)) * 12
          + EXTRACT(MONTH FROM date_trunc('month', o."placedAt")) - EXTRACT(MONTH FROM f.first))::int AS "offset",
        COUNT(DISTINCT o."userId")::int AS customers
      FROM orders o JOIN firsts f ON f."userId" = o."userId"
      WHERE o.status <> 'CANCELLED' AND f.first >= date_trunc('month', NOW()) - make_interval(months => ${months - 1}::int)
      GROUP BY 1, 2`);
    const sizes = new Map(rows.filter((row) => row.offset === 0).map((row) => [row.cohort, row.customers]));
    return cohortMatrix(rows, sizes);
  }

  // ---------- RF-22.6 alto valor ----------
  public async highValue(limit = 50) {
    const rows = await prisma.$queryRaw<StatsRow[]>`${statsQuery({})} SELECT * FROM seg WHERE orders > 0 ORDER BY "ltvCents" DESC LIMIT ${limit * 3}`;
    return rows
      .map(toStats)
      .map((c) => {
        const clv12m = projectedClv(c.orders, c.ltvCents, c.firstOrderAt, c.lastOrderAt);
        const interval = c.orders > 1 && c.firstOrderAt && c.lastOrderAt ? Math.max(30, (c.lastOrderAt.getTime() - c.firstOrderAt.getTime()) / DAY / (c.orders - 1)) : 30;
        const days = c.lastOrderAt ? (Date.now() - c.lastOrderAt.getTime()) / DAY : 0;
        return { id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, orders: c.orders, ltvCents: c.ltvCents, clv12m, churnRisk: classifyChurn(days / interval), segment: c.segment };
      })
      .sort((a, b) => b.clv12m - a.clv12m)
      .slice(0, limit);
  }

  // ---------- RF-22.8 / 22.10 insights de un cliente ----------
  public async insights(userId: string) {
    const [stats] = await prisma.$queryRaw<StatsRow[]>`${statsQuery({ includeIds: [userId] })} SELECT * FROM seg`;
    if (!stats) throw new NotFoundException("Customer", userId);
    const customer = toStats(stats);
    const since = new Date(Date.now() - 6 * 30 * DAY);
    const [cart, points, user, wishlistOnSale, monthly, refunds, failed, prefs, upsell] = await Promise.all([
      prisma.cartItem.count({ where: { cart: { userId, status: "ACTIVE" } } }),
      prisma.loyaltyTransaction.aggregate({ where: { account: { userId }, operation: "ADD", expiresAt: { gte: new Date(), lte: new Date(Date.now() + 30 * DAY) } }, _sum: { points: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { birthDate: true } }),
      prisma.wishlistItem.count({ where: { userId, product: { variants: { some: { isActive: true, compareAtPriceCents: { not: null } } } } } }),
      prisma.$queryRaw<Array<{ month: string; cents: bigint }>>`
        SELECT to_char(date_trunc('month', "placedAt"), 'YYYY-MM') AS month, SUM("totalCents")::bigint AS cents
        FROM orders WHERE "userId" = ${userId} AND status <> 'CANCELLED' AND "placedAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      prisma.refund.count({ where: { order: { userId } } }),
      prisma.payment.count({ where: { userId, status: "FAILED", createdAt: { gte: new Date(Date.now() - 7 * DAY) } } }),
      prisma.notificationPreference.findUnique({ where: { userId }, select: { marketing: true } }),
      // Upsell: productos de sus categorías habituales más caros que su ticket unitario promedio
      prisma.$queryRaw<Array<{ id: string; name: string; slug: string; priceCents: number }>>`
        WITH mine AS (
          SELECT p."categoryId", AVG(oi."unitPriceCents") AS avg FROM order_items oi
          JOIN orders o ON o.id = oi."orderId" AND o."userId" = ${userId} AND o.status <> 'CANCELLED'
          JOIN products p ON p.id = oi."productId" WHERE p."categoryId" IS NOT NULL GROUP BY p."categoryId"
        )
        SELECT p.id, p.name, p.slug, p."minPriceCents" AS "priceCents" FROM products p JOIN mine m ON m."categoryId" = p."categoryId"
        WHERE p.status = 'ACTIVE' AND p."minPriceCents" > m.avg * 1.2
          AND NOT EXISTS (SELECT 1 FROM order_items x JOIN orders y ON y.id = x."orderId" WHERE y."userId" = ${userId} AND x."productId" = p.id)
        ORDER BY p."ratingAvg" DESC, p."minPriceCents" ASC LIMIT 3`,
    ]);
    const interval = customer.orders > 1 && customer.firstOrderAt && customer.lastOrderAt ? Math.max(30, (customer.lastOrderAt.getTime() - customer.firstOrderAt.getTime()) / DAY / (customer.orders - 1)) : 30;
    const churnRisk = customer.lastOrderAt ? classifyChurn((Date.now() - customer.lastOrderAt.getTime()) / DAY / interval) : "LOW";
    const birthdayInDays = user?.birthDate ? daysUntilBirthday(user.birthDate) : null;
    // Serie de 6 meses rellenando con 0 los meses sin compras (el mes actual al final)
    const byMonth = new Map(monthly.map((row) => [row.month, Number(row.cents)]));
    const series = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return byMonth.get(date.toISOString().slice(0, 7)) ?? 0;
    });
    const action = nextBestAction({ segment: customer.segment, orders: customer.orders, churnRisk, activeCartItems: cart, expiringPoints: points._sum.points ?? 0, birthdayInDays, wishlistOnSale, marketingOptIn: Boolean(prefs?.marketing) });
    return {
      churnRisk,
      clv12m: projectedClv(customer.orders, customer.ltvCents, customer.firstOrderAt, customer.lastOrderAt),
      nextBestAction: action,
      anomalies: detectAnomalies({ monthlySpendCents: series, orders: customer.orders, refunds, failedPayments7d: failed }),
      upsell,
      signals: { activeCartItems: cart, expiringPoints: points._sum.points ?? 0, birthdayInDays, wishlistOnSale },
    };
  }

  // ---------- RF-22.4 duplicados y fusión ----------
  // duplicates => mismo celular, o mismo nombre completo y mismo dominio de correo (pares sugeridos, no automáticos)
  public duplicates() {
    return prisma.$queryRaw<Array<{ reason: "PHONE" | "NAME"; ids: string[]; emails: string[]; name: string }>>(Prisma.sql`
      SELECT 'PHONE' AS reason, ARRAY_AGG(id ORDER BY "createdAt") AS ids, ARRAY_AGG(email ORDER BY "createdAt") AS emails, MIN("firstName" || ' ' || "lastName") AS name
      FROM users WHERE phone IS NOT NULL AND "deletedAt" IS NULL AND "isActive" = true GROUP BY phone HAVING COUNT(*) > 1
      UNION ALL
      SELECT 'NAME', ARRAY_AGG(id ORDER BY "createdAt"), ARRAY_AGG(email ORDER BY "createdAt"), MIN("firstName" || ' ' || "lastName")
      FROM users WHERE "deletedAt" IS NULL AND "isActive" = true AND length(trim("firstName" || "lastName")) > 3
      GROUP BY lower(trim("firstName")), lower(trim("lastName")), split_part(email, '@', 2) HAVING COUNT(*) > 1
      LIMIT 100`);
  }

  // merge => mueve pedidos, direcciones, reseñas y lista de deseos del duplicado al principal; une etiquetas y notas;
  // el duplicado queda inactivo con un correo liberado (todo en UNA transacción: o se fusiona todo o nada)
  public async merge(primaryId: string, duplicateId: string, actorId: string) {
    if (primaryId === duplicateId) throw new UnprocessableException("Elige dos clientes distintos", "MERGE_SAME_CUSTOMER");
    const [primary, duplicate] = await Promise.all([prisma.user.findUnique({ where: { id: primaryId } }), prisma.user.findUnique({ where: { id: duplicateId } })]);
    if (!primary || !duplicate) throw new NotFoundException("Customer", !primary ? primaryId : duplicateId);
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { userId: duplicateId }, data: { userId: primaryId } });
      await tx.address.updateMany({ where: { userId: duplicateId }, data: { userId: primaryId, isDefault: false } });
      await tx.review.updateMany({ where: { userId: duplicateId }, data: { userId: primaryId } });
      // Lista de deseos: clave compuesta (userId, productId) => se omiten los productos que el principal ya tiene
      await tx.$executeRaw`INSERT INTO wishlist_items ("userId", "productId", "createdAt") SELECT ${primaryId}, "productId", "createdAt" FROM wishlist_items WHERE "userId" = ${duplicateId} ON CONFLICT DO NOTHING`;
      await tx.wishlistItem.deleteMany({ where: { userId: duplicateId } });
      await tx.user.update({ where: { id: duplicateId }, data: { isActive: false, email: `merged+${duplicateId}@invalid.local`, phone: null } });
      if (!primary.phone && duplicate.phone) await tx.user.update({ where: { id: primaryId }, data: { phone: duplicate.phone } });
    });
    const [main, other] = await Promise.all([CrmProfileModel.findOne({ userId: primaryId }).lean(), CrmProfileModel.findOne({ userId: duplicateId }).lean()]);
    await CrmProfileModel.updateOne(
      { userId: primaryId },
      { $set: { tags: [...new Set([...(main?.tags ?? []), ...(other?.tags ?? [])])] }, $push: { notes: { $each: [...(other?.notes ?? []), { text: `Fusionado con ${duplicate.email}`, authorId: actorId, at: new Date() }] } } },
      { upsert: true }
    );
    await CrmProfileModel.deleteOne({ userId: duplicateId });
    return { primaryId, mergedFrom: duplicate.email };
  }

  // ---------- RF-22.4 importación ----------
  public async importCsv(csv: string, actorId: string) {
    const { rows, errors } = parseCustomerCsv(csv);
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const existing = await prisma.user.findUnique({ where: { email: row.email }, select: { id: true } });
      const id = existing?.id ?? (await authRepository.createUser({ email: row.email, passwordHash: null, firstName: row.firstName, lastName: row.lastName, phone: row.phone, isGuest: true })).id;
      if (existing) updated += 1;
      else created += 1;
      if (row.tags.length) await CrmProfileModel.updateOne({ userId: id }, { $addToSet: { tags: { $each: row.tags } } }, { upsert: true });
    }
    return { created, updated, errors, importedBy: actorId };
  }
}

// daysUntilBirthday => días hasta el próximo cumpleaños (0 = hoy). Función pura
export function daysUntilBirthday(birthDate: Date, today = new Date()): number {
  const next = new Date(today.getFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / DAY);
}

export const insightService = new InsightService();
