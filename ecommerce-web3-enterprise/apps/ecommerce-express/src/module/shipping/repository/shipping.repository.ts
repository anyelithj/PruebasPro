// shipping.repository.ts => acceso a datos de envíos y su timeline (patrón Repository).
import type { Prisma, PrismaClient, ShipmentStatus } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { CarrierStatsDto, ShipmentDto } from "../dto/shipping.dto";
import { isShipmentDelayed, OPEN_SHIPMENT_STATUSES } from "../model/shipping.model";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

const SHIPMENT_INCLUDE = {
  order: { select: { orderNumber: true, userId: true } },
  events: { orderBy: { occurredAt: "asc" } },
} satisfies Prisma.ShipmentInclude;

type ShipmentRow = Prisma.ShipmentGetPayload<{ include: typeof SHIPMENT_INCLUDE }>;

export class ShippingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findMany(status: ShipmentStatus | undefined, page: PageParams): Promise<Paginated<ShipmentDto>> {
    const where: Prisma.ShipmentWhereInput = status ? { status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.shipment.findMany({ where, include: SHIPMENT_INCLUDE, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.limit }),
      this.prisma.shipment.count({ where }),
    ]);
    return { items: rows.map(toDto), total };
  }

  // findById => incluye el dueño de la orden para validar ownership en el service
  public async findById(id: string): Promise<{ shipment: ShipmentDto; userId: string } | null> {
    const row = await this.prisma.shipment.findUnique({ where: { id }, include: SHIPMENT_INCLUDE });
    return row ? { shipment: toDto(row), userId: row.order.userId } : null;
  }

  public async findByOrderId(orderId: string): Promise<ShipmentDto | null> {
    const row = await this.prisma.shipment.findUnique({ where: { orderId }, include: SHIPMENT_INCLUDE });
    return row ? toDto(row) : null;
  }

  // createForOrder => idempotente: si la orden ya tiene shipment (evento repetido) no se duplica
  public async createForOrder(data: { orderId: string; rateCode: string; costCents: number; estimatedDelivery: Date | null }): Promise<void> {
    await this.prisma.shipment.upsert({
      where: { orderId: data.orderId },
      update: {},
      create: {
        ...data,
        events: { create: { status: "PENDING", description: "Pedido recibido, preparando envío" } },
      },
    });
  }

  // findDelayed => RF-09.6 envíos en curso con la fecha estimada vencida y aún sin aviso al cliente
  public async findDelayed(now: Date, limit: number): Promise<Array<{ id: string; orderId: string; orderNumber: string; userId: string }>> {
    const rows = await this.prisma.shipment.findMany({
      where: { status: { in: OPEN_SHIPMENT_STATUSES }, estimatedDelivery: { lt: now }, delayNotifiedAt: null },
      select: { id: true, orderId: true, order: { select: { orderNumber: true, userId: true } } },
      take: limit,
    });
    return rows.map((row) => ({ id: row.id, orderId: row.orderId, orderNumber: row.order.orderNumber, userId: row.order.userId }));
  }

  public async markDelayNotified(id: string): Promise<void> {
    await this.prisma.shipment.update({ where: { id }, data: { delayNotifiedAt: new Date() } });
  }

  // carrierStats => RF-10.7 UNA agregación SQL por transportadora (prefijo del rateCode). "FILTER (WHERE ...)" cuenta
  // subconjuntos sin consultas extra; los valores van parametrizados (${from})
  public async carrierStats(from: Date): Promise<CarrierStatsDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ carrier: string; shipments: bigint; delivered: bigint; on_time: bigint; avg_days: number | null; returned: bigint; cancelled: bigint; delayed_open: bigint; cost: bigint | null }>
    >`
      SELECT split_part(s."rateCode", '_', 1) AS carrier,
        COUNT(*) AS shipments,
        COUNT(*) FILTER (WHERE s."status" = 'DELIVERED') AS delivered,
        COUNT(*) FILTER (WHERE s."status" = 'DELIVERED' AND s."deliveredAt" <= s."estimatedDelivery") AS on_time,
        AVG(EXTRACT(EPOCH FROM (s."deliveredAt" - s."shippedAt")) / 86400) FILTER (WHERE s."deliveredAt" IS NOT NULL AND s."shippedAt" IS NOT NULL) AS avg_days,
        COUNT(*) FILTER (WHERE s."status" = 'RETURNED') AS returned,
        COUNT(*) FILTER (WHERE s."status" = 'CANCELLED') AS cancelled,
        COUNT(*) FILTER (WHERE s."status" IN ('PENDING', 'LABEL_CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY') AND s."estimatedDelivery" < NOW()) AS delayed_open,
        SUM(s."costCents") AS cost
      FROM "shipments" s WHERE s."createdAt" >= ${from}
      GROUP BY 1 ORDER BY shipments DESC`;
    return rows.map((row) => ({
      carrier: row.carrier,
      shipments: Number(row.shipments),
      delivered: Number(row.delivered),
      onTimeRate: Number(row.delivered) > 0 ? Number((Number(row.on_time) / Number(row.delivered)).toFixed(4)) : 0,
      avgDeliveryDays: row.avg_days === null ? null : Number(Number(row.avg_days).toFixed(1)),
      returned: Number(row.returned),
      cancelled: Number(row.cancelled),
      delayedOpen: Number(row.delayed_open),
      costCents: Number(row.cost ?? 0),
    }));
  }

  // transition => cambia el estado y agrega el evento al timeline en la misma transacción
  public async transition(
    id: string,
    status: ShipmentStatus,
    event: { description: string; location?: string | undefined },
    extra: Prisma.ShipmentUpdateInput = {}
  ): Promise<ShipmentDto> {
    const row = await this.prisma.shipment.update({
      where: { id },
      data: {
        ...extra,
        status,
        events: { create: { status, description: event.description, location: event.location ?? null } },
      },
      include: SHIPMENT_INCLUDE,
    });
    return toDto(row);
  }
}

function toDto(row: ShipmentRow): ShipmentDto {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    status: row.status,
    rateCode: row.rateCode,
    carrier: row.carrier,
    service: row.service,
    trackingNumber: row.trackingNumber,
    labelUrl: row.labelUrl,
    costCents: row.costCents,
    estimatedDelivery: row.estimatedDelivery,
    shippedAt: row.shippedAt,
    deliveredAt: row.deliveredAt,
    events: row.events.map(({ status, description, location, occurredAt }) => ({ status, description, location, occurredAt })),
    delayed: isShipmentDelayed(row.status, row.estimatedDelivery),
  };
}

export const shippingRepository = new ShippingRepository(prisma);
