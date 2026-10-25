// crm.repository.ts => clientes y agregados en PostgreSQL (Prisma $queryRaw) + ficha comercial en MongoDB (CrmProfile).
// Patrón Repository + Aggregate: LTV, pedidos, última compra y segmento se calculan en UNA consulta SQL con GROUP BY
// (la base agrega; Node no recorre miles de pedidos en memoria => menos CPU y RAM).
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { CrmProfileModel, SEGMENT_RULES, type Segment } from "../model/crm.model";
import type { AudienceMember, Customer360Dto, CustomerNoteDto, CustomerStats } from "../dto/crm.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export interface CustomerFilters {
  q?: string | undefined;
  segment?: Segment | undefined;
  includeIds?: string[] | undefined; // Solo estos usuarios (etiqueta o archivados)
  excludeIds?: string[] | undefined; // Nunca estos (archivados en el listado normal)
}

export interface ProfileView {
  tags: string[];
  notes: CustomerNoteDto[];
  score: number | null;
  archivedAt: Date | null;
  suiteCrmId: string | null;
}

export type StatsRow = Omit<CustomerStats, "ltvCents"> & { ltvCents: bigint; total?: bigint };

// segmentCase => regla de segmentación en SQL (fuente única: listado, ficha y audiencias de campañas)
const segmentCase = Prisma.sql`CASE
  WHEN s.orders >= ${SEGMENT_RULES.vipOrders} OR s."ltvCents" >= ${SEGMENT_RULES.vipLtvCents} THEN 'VIP'
  WHEN COALESCE(s."lastOrderAt", s."createdAt") < NOW() - make_interval(days => ${SEGMENT_RULES.inactiveDays}::int) THEN 'INACTIVE'
  WHEN s."createdAt" >= NOW() - make_interval(days => ${SEGMENT_RULES.newDays}::int) THEN 'NEW'
  ELSE 'REGULAR' END`;

// statsQuery => CTE de agregados por cliente con los filtros pedidos (Prisma.sql parametriza cada valor: sin inyección)
export function statsQuery(filters: CustomerFilters, extraJoin = Prisma.empty): Prisma.Sql {
  const conditions = [Prisma.sql`u."deletedAt" IS NULL`];
  if (filters.q) conditions.push(Prisma.sql`(u.email ILIKE ${`%${filters.q}%`} OR (u."firstName" || ' ' || u."lastName") ILIKE ${`%${filters.q}%`})`);
  if (filters.includeIds) conditions.push(Prisma.sql`u.id = ANY(${filters.includeIds}::text[])`);
  if (filters.excludeIds?.length) conditions.push(Prisma.sql`u.id <> ALL(${filters.excludeIds}::text[])`);
  return Prisma.sql`
    WITH s AS (
      SELECT u.id, u.email, u."firstName", u."lastName", u.phone, u."createdAt",
        COUNT(o.id)::int AS orders, COALESCE(SUM(o."totalCents"), 0)::bigint AS "ltvCents",
        MAX(o."placedAt") AS "lastOrderAt", MIN(o."placedAt") AS "firstOrderAt"
      FROM users u
      JOIN user_roles ur ON ur."userId" = u.id
      JOIN roles r ON r.id = ur."roleId" AND r.name = 'CUSTOMER'
      ${extraJoin}
      LEFT JOIN orders o ON o."userId" = u.id AND o.status <> 'CANCELLED'
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY u.id
    ), seg AS (SELECT s.*, ${segmentCase} AS segment FROM s)`;
}

export class CrmRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  // findStats => página de clientes con agregados y segmento; "COUNT(*) OVER()" trae el total en la misma consulta
  public async findStats(filters: CustomerFilters, page: PageParams): Promise<Paginated<CustomerStats>> {
    const segmentFilter = filters.segment ? Prisma.sql`WHERE segment = ${filters.segment}` : Prisma.empty;
    const rows = await this.db.$queryRaw<StatsRow[]>`
      ${statsQuery(filters)}
      SELECT seg.*, COUNT(*) OVER() AS total FROM seg ${segmentFilter}
      ORDER BY "ltvCents" DESC, "createdAt" DESC LIMIT ${page.limit} OFFSET ${page.skip}`;
    return { items: rows.map(toStats), total: Number(rows[0]?.total ?? 0) };
  }

  public async findStatsById(id: string): Promise<CustomerStats | null> {
    const [row] = await this.db.$queryRaw<StatsRow[]>`${statsQuery({ includeIds: [id] })} SELECT * FROM seg`;
    return row ? toStats(row) : null;
  }

  // findAudience => destinatarios de una campaña: segmento elegido + opt-in de marketing (GDPR) + cuenta activa
  public async findAudience(segment: Segment | "ALL", excludeIds: string[], limit = 10_000): Promise<AudienceMember[]> {
    const consent = Prisma.sql`JOIN notification_preferences np ON np."userId" = u.id AND np.marketing = true`;
    const segmentFilter = segment === "ALL" ? Prisma.empty : Prisma.sql`WHERE segment = ${segment}`;
    const rows = await this.db.$queryRaw<Array<{ id: string; email: string; firstName: string; lastName: string; phone: string | null }>>`
      ${statsQuery({ excludeIds }, consent)}
      SELECT id, email, "firstName", "lastName", phone FROM seg ${segmentFilter} LIMIT ${limit}`;
    return rows.map((row) => ({ userId: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName, phone: row.phone }));
  }

  // details360 => datos complementarios de la ficha en paralelo (pedidos recientes, categorías, fidelidad, reseñas)
  public async details360(userId: string): Promise<Pick<Customer360Dto, "recentOrders" | "favoriteCategories" | "loyalty" | "reviews">> {
    const [recentOrders, favoriteCategories, loyalty, reviews] = await Promise.all([
      this.db.order.findMany({ where: { userId }, orderBy: { placedAt: "desc" }, take: 5, select: { id: true, orderNumber: true, status: true, totalCents: true, currency: true, placedAt: true } }),
      this.db.$queryRaw<Array<{ name: string; units: bigint }>>`
        SELECT c.name, SUM(oi.quantity)::bigint AS units
        FROM order_items oi JOIN orders o ON o.id = oi."orderId" AND o."userId" = ${userId} AND o.status <> 'CANCELLED'
        JOIN products p ON p.id = oi."productId" JOIN categories c ON c.id = p."categoryId"
        GROUP BY c.name ORDER BY units DESC LIMIT 3`,
      this.db.loyaltyAccount.findUnique({ where: { userId }, select: { tier: true, pointsBalance: true } }),
      this.db.review.count({ where: { userId } }),
    ]);
    return { recentOrders, favoriteCategories: favoriteCategories.map((row) => ({ name: row.name, units: Number(row.units) })), loyalty, reviews };
  }

  public updateContact(id: string, data: { firstName?: string; lastName?: string; phone?: string }): Promise<unknown> {
    return this.db.user.update({ where: { id }, data });
  }

  // --- Ficha comercial (MongoDB) ---

  public async profiles(userIds: string[]): Promise<Map<string, ProfileView>> {
    const docs = await CrmProfileModel.find({ userId: { $in: userIds } }).lean();
    return new Map(docs.map((doc) => [doc.userId, toProfile(doc)]));
  }

  public async profile(userId: string): Promise<ProfileView | null> {
    const doc = await CrmProfileModel.findOne({ userId }).lean();
    return doc ? toProfile(doc) : null;
  }

  // idsWhere => IDs de clientes archivados o con una etiqueta (conjuntos pequeños que se pasan al SQL)
  public async archivedIds(): Promise<string[]> {
    return (await CrmProfileModel.find({ archivedAt: { $type: "date" } }, { userId: 1 }).lean()).map((doc) => doc.userId);
  }

  public async taggedIds(tag: string): Promise<string[]> {
    return (await CrmProfileModel.find({ tags: tag }, { userId: 1 }).lean()).map((doc) => doc.userId);
  }

  // upsertProfile => "upsert" crea la ficha la primera vez que se edita (los clientes existen antes que su ficha)
  public async upsertProfile(userId: string, changes: { tags?: string[]; score?: number | null; archivedAt?: Date | null; suiteCrmId?: string; note?: CustomerNoteDto }): Promise<ProfileView> {
    const { note, ...fields } = changes;
    const doc = await CrmProfileModel.findOneAndUpdate(
      { userId },
      { $set: fields, ...(note ? { $push: { notes: { $each: [note], $slice: -100 } } } : {}) }, // "$slice" => máximo 100 notas
      { upsert: true, new: true }
    ).lean();
    return toProfile(doc);
  }
}

export function toStats(row: StatsRow): CustomerStats {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    createdAt: row.createdAt,
    orders: Number(row.orders),
    ltvCents: Number(row.ltvCents), // BIGINT llega como bigint: se convierte (montos < 2^53)
    lastOrderAt: row.lastOrderAt,
    firstOrderAt: row.firstOrderAt,
    segment: row.segment,
  };
}

// RawProfile => forma mínima del documento (los arreglos de subdocumentos de Mongoose no encajan con Partial<> estricto)
type Maybe<T> = T | null | undefined;
type RawProfile = { tags?: Maybe<string[]>; notes?: Maybe<Array<{ text?: Maybe<string>; authorId?: Maybe<string>; at?: Maybe<Date> }>>; score?: Maybe<number>; archivedAt?: Maybe<Date>; suiteCrmId?: Maybe<string> };

function toProfile(doc: RawProfile | null): ProfileView {
  return {
    tags: doc?.tags ?? [],
    notes: (doc?.notes ?? []).map((note) => ({ text: note.text ?? "", authorId: note.authorId ?? "", at: note.at ?? new Date() })),
    score: doc?.score ?? null,
    archivedAt: doc?.archivedAt ?? null,
    suiteCrmId: doc?.suiteCrmId ?? null,
  };
}

export const crmRepository = new CrmRepository();
