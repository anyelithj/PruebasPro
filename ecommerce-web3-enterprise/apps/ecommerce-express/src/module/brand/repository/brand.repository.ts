// brand.repository.ts => acceso a datos de marcas (patrón Repository sobre Prisma).
import { Prisma, type PrismaClient } from "@prisma/client"; // "Prisma" como valor: Prisma.sql (SQL parametrizado)
import { prisma } from "../../../config/database.config";
import { BrandEntity } from "../model/brand.model";
import type { BrandDetailDto } from "../dto/brand.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

const BRAND_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  logoPublicId: true,
  website: true,
  story: true,
  country: true,
  isPremium: true,
  isExclusive: true,
  isActive: true,
  _count: { select: { products: { where: { status: "ACTIVE" } } } }, // Solo productos publicados
} satisfies Prisma.BrandSelect;

type BrandRow = Prisma.BrandGetPayload<{ select: typeof BRAND_SELECT }>;

export class BrandRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findMany(
    filter: { q?: string | undefined; premium?: boolean | undefined; exclusive?: boolean | undefined },
    onlyActive: boolean,
    page: PageParams
  ): Promise<Paginated<BrandEntity>> {
    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
      ...(onlyActive ? { isActive: true } : {}),
      ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" } } : {}),
      ...(filter.premium !== undefined ? { isPremium: filter.premium } : {}),
      ...(filter.exclusive !== undefined ? { isExclusive: filter.exclusive } : {}),
    };
    const [rows, total] = await Promise.all([
      // RF-05.3: las marcas premium aparecen primero ("desc": true antes que false), luego por nombre
      this.prisma.brand.findMany({ where, select: BRAND_SELECT, orderBy: [{ isPremium: "desc" }, { name: "asc" }], skip: page.skip, take: page.limit }),
      this.prisma.brand.count({ where }),
    ]);
    return { items: rows.map(toEntity), total };
  }

  public async findByIdOrSlug(idOrSlug: string, isUuid: boolean): Promise<BrandEntity | null> {
    const row = await this.prisma.brand.findFirst({
      where: { deletedAt: null, ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }) },
      select: BRAND_SELECT,
    });
    return row ? toEntity(row) : null;
  }

  // findProducts => tarjetas de productos activos de la marca (para la página /brands/[slug])
  public async findProducts(brandId: string, limit: number): Promise<BrandDetailDto["products"]> {
    const rows = await this.prisma.product.findMany({
      where: { brandId, status: "ACTIVE" },
      select: { id: true, name: true, slug: true, minPriceCents: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    // "?.url ?? null" => primera imagen o null si el producto no tiene imágenes
    return rows.map(({ images, ...product }) => ({ ...product, imageUrl: images[0]?.url ?? null }));
  }

  // salesStats => RF-05.4 agregados de ventas de la marca con SQL nativo ($queryRaw con parámetros: sin inyección).
  // Una sola pasada por order_items + orders + products; "::int"/"::bigint" fija tipos numéricos en el resultado
  public async salesStats(brandId: string): Promise<{
    totals: { orders: number; units: number; revenueCents: number };
    top: Array<{ productName: string; units: number; revenueCents: number }>;
    monthly: Array<{ month: string; units: number; revenueCents: number }>;
  }> {
    const base = Prisma.sql`FROM order_items oi JOIN orders o ON o.id = oi."orderId" JOIN products p ON p.id = oi."productId"
      WHERE p."brandId" = ${brandId} AND o.status <> 'CANCELLED'`;
    const [totals, top, monthly] = await Promise.all([
      this.prisma.$queryRaw<Array<{ orders: number; units: bigint | null; revenue: bigint | null }>>`SELECT COUNT(DISTINCT o.id)::int AS orders, SUM(oi.quantity)::bigint AS units, SUM(oi."totalCents")::bigint AS revenue ${base}`,
      this.prisma.$queryRaw<Array<{ name: string; units: bigint; revenue: bigint }>>`SELECT oi."productName" AS name, SUM(oi.quantity)::bigint AS units, SUM(oi."totalCents")::bigint AS revenue ${base} GROUP BY oi."productName" ORDER BY revenue DESC LIMIT 5`,
      this.prisma.$queryRaw<Array<{ month: string; units: bigint; revenue: bigint }>>`SELECT to_char(date_trunc('month', o."placedAt"), 'YYYY-MM') AS month, SUM(oi.quantity)::bigint AS units, SUM(oi."totalCents")::bigint AS revenue ${base} AND o."placedAt" >= date_trunc('month', now()) - interval '11 months' GROUP BY 1 ORDER BY 1`,
    ]);
    const row = totals[0];
    // "Number(bigint)" => los montos caben en Number (centavos de un portafolio); JSON no serializa BigInt
    return {
      totals: { orders: row?.orders ?? 0, units: Number(row?.units ?? 0), revenueCents: Number(row?.revenue ?? 0) },
      top: top.map((item) => ({ productName: item.name, units: Number(item.units), revenueCents: Number(item.revenue) })),
      monthly: monthly.map((item) => ({ month: item.month, units: Number(item.units), revenueCents: Number(item.revenue) })),
    };
  }

  public async slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    return (await this.prisma.brand.count({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) } })) > 0;
  }

  public async create(data: Prisma.BrandCreateInput): Promise<BrandEntity> {
    return toEntity(await this.prisma.brand.create({ data, select: BRAND_SELECT }));
  }

  public async update(id: string, data: Prisma.BrandUpdateInput): Promise<BrandEntity> {
    return toEntity(await this.prisma.brand.update({ where: { id }, data, select: BRAND_SELECT }));
  }

  // softDelete => marca eliminada lógicamente; nombre y slug se liberan para reutilizarse
  public async softDelete(id: string): Promise<void> {
    await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, slug: `${id}-deleted`, name: `${id}-deleted` },
    });
  }
}

function toEntity(row: BrandRow): BrandEntity {
  const { _count, logoPublicId, ...rest } = row;
  return new BrandEntity({ ...rest, productCount: _count.products }, logoPublicId);
}

export const brandRepository = new BrandRepository(prisma);
