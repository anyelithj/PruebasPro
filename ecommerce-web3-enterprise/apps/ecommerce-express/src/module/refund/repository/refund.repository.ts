// refund.repository.ts => acceso a datos de devoluciones.
import type { Prisma, PrismaClient, RefundStatus } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { RefundDto } from "../dto/refund.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

const REFUND_INCLUDE = { order: { select: { orderNumber: true, currency: true } } } satisfies Prisma.RefundInclude;
type RefundRow = Prisma.RefundGetPayload<{ include: typeof REFUND_INCLUDE }>;

export class RefundRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findMany(userId: string | undefined, status: RefundStatus | undefined, page: PageParams): Promise<Paginated<RefundDto>> {
    const where: Prisma.RefundWhereInput = { ...(userId ? { userId } : {}), ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.refund.findMany({ where, include: REFUND_INCLUDE, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.limit }),
      this.prisma.refund.count({ where }),
    ]);
    return { items: rows.map(toDto), total };
  }

  public async findById(id: string): Promise<RefundDto | null> {
    const row = await this.prisma.refund.findUnique({ where: { id }, include: REFUND_INCLUDE });
    return row ? toDto(row) : null;
  }

  // committedCents => suma de devoluciones activas (no rechazadas/canceladas) de un pedido
  public async committedCents(orderId: string): Promise<number> {
    const aggregate = await this.prisma.refund.aggregate({
      where: { orderId, status: { in: ["REQUESTED", "APPROVED", "PROCESSED"] } },
      _sum: { amountCents: true },
    });
    return aggregate._sum.amountCents ?? 0;
  }

  public async create(data: Prisma.RefundUncheckedCreateInput): Promise<RefundDto> {
    return toDto(await this.prisma.refund.create({ data, include: REFUND_INCLUDE }));
  }

  // stats => RF-12.9 agregaciones del período (GROUP BY en PostgreSQL; sin traer filas)
  public async stats(from: Date) {
    const where = { createdAt: { gte: from } };
    const [byStatus, byReason, byResolution, refunded, delivered, resolution] = await Promise.all([
      this.prisma.refund.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.refund.groupBy({ by: ["reason"], where, _count: { _all: true }, orderBy: { _count: { reason: "desc" } } }),
      this.prisma.refund.groupBy({ by: ["resolution"], where, _count: { _all: true } }),
      this.prisma.refund.aggregate({ where: { ...where, status: "PROCESSED", resolution: "REFUND" }, _sum: { amountCents: true } }),
      this.prisma.order.count({ where: { status: "DELIVERED", placedAt: { gte: from } } }),
      this.prisma.$queryRaw<Array<{ hours: number | null }>>`
        SELECT AVG(EXTRACT(EPOCH FROM ("processedAt" - "createdAt")) / 3600) AS hours FROM "refunds" WHERE "createdAt" >= ${from} AND "processedAt" IS NOT NULL`,
    ]);
    return { byStatus, byReason, byResolution, refundedCents: refunded._sum.amountCents ?? 0, delivered, avgResolutionHours: resolution[0]?.hours ?? null };
  }

  public async update(id: string, data: Prisma.RefundUncheckedUpdateInput): Promise<RefundDto> {
    return toDto(await this.prisma.refund.update({ where: { id }, data, include: REFUND_INCLUDE }));
  }
}

function toDto(row: RefundRow): RefundDto {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    userId: row.userId,
    reason: row.reason,
    description: row.description,
    evidenceUrls: row.evidenceUrls,
    amountCents: row.amountCents,
    currency: row.order.currency,
    status: row.status,
    reviewNote: row.reviewNote,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    resolution: row.resolution,
    exchangeVariantId: row.exchangeVariantId,
    exchangeOrderId: row.exchangeOrderId,
    storeCreditCode: row.storeCreditCode,
    returnStatus: row.returnStatus,
    returnCarrier: row.returnCarrier,
    returnTrackingNumber: row.returnTrackingNumber,
    pickupScheduledAt: row.pickupScheduledAt,
    receivedAt: row.receivedAt,
    inspection: (row.inspection as RefundDto["inspection"]) ?? null,
  };
}

export const refundRepository = new RefundRepository(prisma);
