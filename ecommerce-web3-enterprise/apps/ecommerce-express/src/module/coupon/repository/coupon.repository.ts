// coupon.repository.ts => acceso a datos de cupones y sus redenciones (patrón Repository).
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { CouponDto, CouponWithMetricsDto } from "../dto/coupon.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export class CouponRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findMany(active: boolean | undefined, page: PageParams): Promise<Paginated<CouponWithMetricsDto>> {
    const now = new Date();
    // "active" => vigentes ahora mismo (activos, iniciados y no vencidos)
    const where: Prisma.CouponWhereInput =
      active === undefined
        ? {}
        : active
          ? { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
          : { OR: [{ isActive: false }, { endsAt: { lt: now } }] };

    const [rows, total] = await Promise.all([
      this.prisma.coupon.findMany({ where, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.limit }),
      this.prisma.coupon.count({ where }),
    ]);
    // Métricas agregadas por cupón en UNA consulta groupBy (evita N+1)
    const metrics = await this.prisma.couponRedemption.groupBy({
      by: ["couponId"],
      where: { couponId: { in: rows.map((row) => row.id) } },
      _count: { _all: true },
      _sum: { discountCents: true },
    });
    const byId = new Map(metrics.map((metric) => [metric.couponId, metric]));
    return {
      items: rows.map((row) => ({
        ...toDto(row),
        redemptions: byId.get(row.id)?._count._all ?? 0,
        totalDiscountCents: byId.get(row.id)?._sum.discountCents ?? 0,
      })),
      total,
    };
  }

  public async findById(id: string): Promise<CouponDto | null> {
    const row = await this.prisma.coupon.findUnique({ where: { id } });
    return row ? toDto(row) : null;
  }

  public async findByCode(code: string): Promise<CouponDto | null> {
    const row = await this.prisma.coupon.findUnique({ where: { code } });
    return row ? toDto(row) : null;
  }

  // countUserRedemptions => usos del cupón por un usuario (regla "usagePerUser")
  public async countUserRedemptions(couponId: string, userId: string): Promise<number> {
    return this.prisma.couponRedemption.count({ where: { couponId, userId } });
  }

  public async create(data: Prisma.CouponCreateInput): Promise<CouponDto> {
    return toDto(await this.prisma.coupon.create({ data }));
  }

  public async update(id: string, data: Prisma.CouponUpdateInput): Promise<CouponDto> {
    return toDto(await this.prisma.coupon.update({ where: { id }, data }));
  }
}

// toDto => proyección explícita (sin timestamps internos)
function toDto(row: Prisma.CouponGetPayload<object>): CouponDto {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...coupon } = row;
  return coupon;
}

export const couponRepository = new CouponRepository(prisma);
