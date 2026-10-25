// dashboard.repository.ts => configuración de widgets (MongoDB) + contadores operativos del panel (PostgreSQL).
// Patrón Repository: el service (Facade) no conoce Mongoose ni Prisma.
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { DashboardWidgetModel, type WidgetRecord, type WidgetType } from "../model/dashboard.model";
import type { WidgetDto } from "../dto/dashboard.dto";
import { Roles } from "../../../shared/constants/roles.constants";

export type WidgetWrite = Partial<Omit<WidgetDto, "id">>;

export class DashboardRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  // --- Widgets (MongoDB) ---

  public async findWidgets(userId: string): Promise<WidgetDto[]> {
    return (await DashboardWidgetModel.find({ userId }).sort({ "position.y": 1, "position.x": 1 }).lean()).map(toWidget);
  }

  public countWidgets(userId: string): Promise<number> {
    return DashboardWidgetModel.countDocuments({ userId });
  }

  public async createWidget(userId: string, data: Omit<WidgetDto, "id">): Promise<WidgetDto> {
    return toWidget((await DashboardWidgetModel.create({ ...data, userId })).toObject());
  }

  // updateWidget / deleteWidget => filtran también por userId: un admin nunca toca el panel de otro (ownership)
  public async updateWidget(id: string, userId: string, changes: WidgetWrite): Promise<WidgetDto | null> {
    const doc = await DashboardWidgetModel.findOneAndUpdate({ _id: id, userId }, { $set: changes }, { new: true }).lean();
    return doc ? toWidget(doc) : null;
  }

  public async deleteWidget(id: string, userId: string): Promise<boolean> {
    return (await DashboardWidgetModel.deleteOne({ _id: id, userId })).deletedCount === 1;
  }

  // --- Contadores operativos (PostgreSQL): COUNT con índices, sin traer filas ---

  public countActiveOrders(): Promise<number> {
    return this.db.order.count({ where: { status: { in: ["CONFIRMED", "PREPARING", "PACKED", "SHIPPED"] } } });
  }

  public countPendingRefunds(): Promise<number> {
    return this.db.refund.count({ where: { status: "REQUESTED" } });
  }

  public countNewCustomers(from: Date, to: Date): Promise<number> {
    return this.db.user.count({ where: { createdAt: { gte: from, lte: to }, deletedAt: null, roles: { some: { role: { name: Roles.CUSTOMER } } } } });
  }

  // --- Panel del VENDEDOR: todo filtrado por product.vendorId (ownership: nunca ve datos de otro vendedor) ---

  // vendorSales => ingresos, unidades y pedidos de SUS líneas en el período (los pedidos cancelados no cuentan)
  public async vendorSales(vendorId: string, from: Date, to: Date): Promise<{ revenueCents: number; units: number; orders: number }> {
    // Filtro del pedido compartido por las dos consultas (DRY); "as const" => Prisma recibe el literal del enum
    const order = { placedAt: { gte: from, lte: to }, status: { not: "CANCELLED" as const } };
    // Promise.all => SUM y COUNT en paralelo (dos viajes a PostgreSQL al mismo tiempo)
    const [sum, orders] = await Promise.all([
      this.db.orderItem.aggregate({ where: { product: { vendorId }, order }, _sum: { totalCents: true, quantity: true } }), // "_sum" => SUM()
      this.db.order.count({ where: { ...order, items: { some: { product: { vendorId } } } } }),
    ]);
    return { revenueCents: sum._sum.totalCents ?? 0, units: sum._sum.quantity ?? 0, orders }; // "??" => 0 si no hubo ventas
  }

  // countVendorProducts => SUS productos por estado (borrador / publicado / archivado) en UNA agregación GROUP BY
  public async countVendorProducts(vendorId: string): Promise<Record<"DRAFT" | "ACTIVE" | "ARCHIVED", number>> {
    const rows = await this.db.product.groupBy({ by: ["status"], where: { vendorId }, _count: { _all: true } });
    const counts = { DRAFT: 0, ACTIVE: 0, ARCHIVED: 0 };
    for (const row of rows) counts[row.status] = row._count._all; // "for...of" => recorre las filas agrupadas
    return counts;
  }

  // countVendorActiveOrders => pedidos en curso con al menos una línea suya (los que debe despachar)
  public countVendorActiveOrders(vendorId: string): Promise<number> {
    return this.db.order.count({ where: { status: { in: ["CONFIRMED", "PREPARING", "PACKED", "SHIPPED"] }, items: { some: { product: { vendorId } } } } });
  }

  // countVendorLowStock => SUS variantes con disponible (stock - reservado) <= umbral. $queryRaw porque Prisma no
  // compara dos columnas entre sí; los valores viajan como parámetros (${...}) => sin inyección SQL
  public async countVendorLowStock(vendorId: string, threshold: number): Promise<number> {
    const [row] = await this.db.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM product_variants v JOIN products p ON p.id = v."productId"
      WHERE p."vendorId" = ${vendorId} AND p."archivedAt" IS NULL AND v."isActive" AND (v.stock - v."reservedStock") <= ${threshold}`;
    return Number(row?.n ?? 0); // COUNT(*) llega como bigint => Number para serializar a JSON
  }

  // vendorTopProducts => SUS 5 productos más vendidos del período (GROUP BY nombre, ORDER BY ingresos DESC)
  public async vendorTopProducts(vendorId: string, from: Date, to: Date): Promise<Array<{ name: string; revenueCents: number; units: number }>> {
    const rows = await this.db.orderItem.groupBy({
      by: ["productName"],
      where: { product: { vendorId }, order: { placedAt: { gte: from, lte: to }, status: { not: "CANCELLED" } } },
      _sum: { totalCents: true, quantity: true },
      orderBy: { _sum: { totalCents: "desc" } },
      take: 5,
    });
    return rows.map((row) => ({ name: row.productName, revenueCents: row._sum.totalCents ?? 0, units: row._sum.quantity ?? 0 }));
  }
}

function toWidget(doc: Partial<WidgetRecord> & { _id: unknown }): WidgetDto {
  const position = doc.position ?? { x: 0, y: 0, w: 3, h: 1 };
  return {
    id: String(doc._id),
    type: (doc.type ?? "KPI") as WidgetType,
    title: doc.title ?? "",
    position: { x: position.x ?? 0, y: position.y ?? 0, w: position.w ?? 3, h: position.h ?? 1 },
    config: (doc.config ?? {}) as Record<string, unknown>,
  };
}

export const dashboardRepository = new DashboardRepository();
