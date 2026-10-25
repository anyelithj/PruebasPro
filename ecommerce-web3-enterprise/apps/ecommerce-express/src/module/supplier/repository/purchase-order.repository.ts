// purchase-order.repository.ts (Prisma · PostgreSQL) => acceso a datos de compras: órdenes con sus líneas, consecutivo,
// cuentas por pagar, estadísticas por proveedor (ranking), últimos costos por SKU (comparación) y capas de costo.
// Patrón Repository (el service no conoce Prisma) + Query Object (SQL parametrizado con Prisma.sql).
import { Prisma, type PrismaClient, type PurchaseOrderStatus } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";
import type { SupplierStats } from "../model/procurement.model";

// INCLUDE => la orden con proveedor y líneas (SKU y nombre del producto) en UNA consulta
const INCLUDE = {
  supplier: { select: { id: true, name: true, email: true, phone: true, paymentTermsDays: true, currency: true } },
  items: { include: { variant: { select: { sku: true, name: true, product: { select: { name: true } } } } } },
} satisfies Prisma.PurchaseOrderInclude;
export type PurchaseOrderRow = Prisma.PurchaseOrderGetPayload<{ include: typeof INCLUDE }>;

export class PurchaseOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // nextSequence => consecutivo del año: cuenta las órdenes del año dentro de la misma transacción de creación
  public async create(data: { supplierId: string; currency: string; expectedAt: Date | null; notes: string | null; createdById: string; items: Array<{ variantId: string; quantity: number; unitCostCents: number }> }, number: (sequence: number) => string): Promise<PurchaseOrderRow> {
    return this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const sequence = (await tx.purchaseOrder.count({ where: { createdAt: { gte: new Date(year, 0, 1) } } })) + 1;
      return tx.purchaseOrder.create({
        data: {
          number: number(sequence),
          supplierId: data.supplierId,
          currency: data.currency,
          expectedAt: data.expectedAt,
          notes: data.notes,
          createdById: data.createdById,
          totalCents: data.items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0),
          items: { create: data.items },
        },
        include: INCLUDE,
      });
    });
  }

  public findById(id: string): Promise<PurchaseOrderRow | null> {
    return this.prisma.purchaseOrder.findUnique({ where: { id }, include: INCLUDE });
  }

  public async findMany(where: Prisma.PurchaseOrderWhereInput, page: PageParams): Promise<Paginated<PurchaseOrderRow>> {
    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where, include: INCLUDE, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.limit }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { items, total };
  }

  // replaceItems => en borrador las líneas se reemplazan completas y se recalcula el total
  public async update(id: string, data: { items?: Array<{ variantId: string; quantity: number; unitCostCents: number }> | undefined; expectedAt?: Date | null | undefined; notes?: string | null | undefined }): Promise<PurchaseOrderRow> {
    return this.prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        await tx.purchaseOrderItem.createMany({ data: data.items.map((item) => ({ ...item, purchaseOrderId: id })) });
      }
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(data.items ? { totalCents: data.items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0) } : {}),
          ...(data.expectedAt !== undefined ? { expectedAt: data.expectedAt } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
        include: INCLUDE,
      });
    });
  }

  // setStatus => transición condicionada al estado actual (dos peticiones simultáneas no la aplican dos veces)
  public async setStatus(id: string, from: PurchaseOrderStatus[], data: Prisma.PurchaseOrderUpdateManyMutationInput): Promise<boolean> {
    return (await this.prisma.purchaseOrder.updateMany({ where: { id, status: { in: from } }, data })).count === 1;
  }

  // receive => QC por línea + capas de costo de lo aceptado, en UNA transacción (el stock lo mueve el service)
  public async receive(id: string, lines: Array<{ itemId: string; accepted: number; rejected: number; qcNotes: string | null }>): Promise<PurchaseOrderRow> {
    return this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const item = await tx.purchaseOrderItem.update({
          where: { id: line.itemId, purchaseOrderId: id },
          data: { receivedQuantity: { increment: line.accepted }, rejectedQuantity: { increment: line.rejected }, qcNotes: line.qcNotes },
        });
        if (line.accepted > 0) await tx.inventoryCostLayer.create({ data: { variantId: item.variantId, quantity: line.accepted, unitCostCents: item.unitCostCents, purchaseOrderId: id } });
      }
      return tx.purchaseOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE });
    });
  }

  // dueSoon => cuentas por pagar abiertas que vencen antes de "until" y sin alerta hoy (RF-23.8)
  public dueSoon(until: Date, alertedBefore: Date): Promise<PurchaseOrderRow[]> {
    return this.prisma.purchaseOrder.findMany({
      where: { paidAt: null, dueAt: { lte: until }, status: { in: ["PARTIAL", "RECEIVED"] }, OR: [{ dueAlertAt: null }, { dueAlertAt: { lt: alertedBefore } }] },
      include: INCLUDE,
      take: 100,
    });
  }

  // supplierStats => RF-23.5 una consulta para todos los proveedores: puntualidad, QC y precio relativo
  public async supplierStats(): Promise<Array<SupplierStats & { name: string; totalCents: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{ supplierId: string; name: string; rating: number | null; orders: number; onTime: number; received: number; rejected: number; totalCents: bigint; priceIndex: number | null }>>(Prisma.sql`
      WITH market AS (
        SELECT "variantId", AVG("unitCostCents")::float AS avg FROM purchase_order_items GROUP BY "variantId"
      )
      SELECT s.id AS "supplierId", s.name, s.rating,
        COUNT(DISTINCT po.id) FILTER (WHERE po."receivedAt" IS NOT NULL)::int AS orders,
        COUNT(DISTINCT po.id) FILTER (WHERE po."receivedAt" IS NOT NULL AND (po."expectedAt" IS NULL OR po."receivedAt" <= po."expectedAt" + INTERVAL '1 day'))::int AS "onTime",
        COALESCE(SUM(i."receivedQuantity"), 0)::int AS received,
        COALESCE(SUM(i."rejectedQuantity"), 0)::int AS rejected,
        COALESCE(SUM(i.quantity * i."unitCostCents") FILTER (WHERE po.status <> 'CANCELLED'), 0)::bigint AS "totalCents",
        AVG(i."unitCostCents" / NULLIF(m.avg, 0))::float AS "priceIndex"
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po."supplierId" = s.id
      LEFT JOIN purchase_order_items i ON i."purchaseOrderId" = po.id
      LEFT JOIN market m ON m."variantId" = i."variantId"
      WHERE s."isActive" = true
      GROUP BY s.id`);
    return rows.map((row) => ({ ...row, totalCents: Number(row.totalCents) }));
  }

  // priceComparison => RF-23.8 último costo y costo promedio de cada SKU por proveedor
  public priceComparison(filter: { variantId?: string | undefined; q?: string | undefined }) {
    const conditions = [Prisma.sql`po.status <> 'CANCELLED'`];
    if (filter.variantId) conditions.push(Prisma.sql`i."variantId" = ${filter.variantId}`);
    if (filter.q) conditions.push(Prisma.sql`(v.sku ILIKE ${`%${filter.q}%`} OR p.name ILIKE ${`%${filter.q}%`})`);
    return this.prisma.$queryRaw<Array<{ variantId: string; sku: string; productName: string; supplierId: string; supplierName: string; lastCostCents: number; avgCostCents: number; lastOrderAt: Date }>>(Prisma.sql`
      SELECT i."variantId", v.sku, p.name AS "productName", s.id AS "supplierId", s.name AS "supplierName",
        (ARRAY_AGG(i."unitCostCents" ORDER BY po."createdAt" DESC))[1] AS "lastCostCents",
        ROUND(AVG(i."unitCostCents"))::int AS "avgCostCents", MAX(po."createdAt") AS "lastOrderAt"
      FROM purchase_order_items i
      JOIN purchase_orders po ON po.id = i."purchaseOrderId"
      JOIN suppliers s ON s.id = po."supplierId"
      JOIN product_variants v ON v.id = i."variantId"
      JOIN products p ON p.id = v."productId"
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY i."variantId", v.sku, p.name, s.id, s.name
      ORDER BY v.sku, "lastCostCents" ASC
      LIMIT 300`);
  }

  // valuationRows => stock actual + capas de costo de cada variante con stock (RF-23.3)
  public valuationRows(limit: number) {
    return this.prisma.productVariant.findMany({
      where: { stock: { gt: 0 } },
      select: { id: true, sku: true, name: true, stock: true, product: { select: { name: true } }, costLayers: { select: { quantity: true, unitCostCents: true, createdAt: true } } },
      orderBy: { stock: "desc" },
      take: limit,
    });
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository(prisma);
