// collection.repository.ts => acceso a datos de colecciones (patrón Repository sobre Prisma).
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { CollectionDetailDto, CollectionDto } from "../dto/collection.dto";

const COLLECTION_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  startsAt: true,
  endsAt: true,
  lookDiscountPercent: true,
  isActive: true,
  _count: { select: { products: true } },
} satisfies Prisma.CollectionSelect;

type CollectionRow = Prisma.CollectionGetPayload<{ select: typeof COLLECTION_SELECT }>;

// Filtro de vigencia en SQL: activa y dentro de la ventana (NULL = sin límite)
function liveWhere(now: Date): Prisma.CollectionWhereInput {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

export class CollectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // findMany => "listar colecciones activas con productos" (el staff puede ver todas)
  public async findMany(onlyLive: boolean): Promise<CollectionDto[]> {
    const rows = await this.prisma.collection.findMany({
      where: { deletedAt: null, ...(onlyLive ? liveWhere(new Date()) : {}) },
      select: COLLECTION_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDto);
  }

  public async findByIdOrSlug(idOrSlug: string, isUuid: boolean): Promise<CollectionDto | null> {
    const row = await this.prisma.collection.findFirst({
      where: { deletedAt: null, ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }) },
      select: COLLECTION_SELECT,
    });
    return row ? toDto(row) : null;
  }

  // findProducts => productos ACTIVOS de la colección en su orden manual
  public async findProducts(collectionId: string): Promise<CollectionDetailDto["products"]> {
    const rows = await this.prisma.collectionProduct.findMany({
      where: { collectionId, product: { status: "ACTIVE" } },
      orderBy: { position: "asc" },
      select: {
        position: true,
        product: {
          select: { id: true, name: true, slug: true, minPriceCents: true, images: { take: 1, orderBy: { position: "asc" }, select: { url: true } } },
        },
      },
    });
    return rows.map(({ position, product: { images, ...product } }) => ({ ...product, position, imageUrl: images[0]?.url ?? null }));
  }

  // findLiveLooks => RF-05.5 colecciones vigentes con descuento de look y los IDs de sus productos ACTIVOS
  public async findLiveLooks(): Promise<Array<{ id: string; name: string; percent: number; productIds: string[] }>> {
    const rows = await this.prisma.collection.findMany({
      where: { deletedAt: null, lookDiscountPercent: { not: null }, ...liveWhere(new Date()) },
      select: { id: true, name: true, lookDiscountPercent: true, products: { where: { product: { status: "ACTIVE" } }, select: { productId: true } } },
    });
    return rows.map((row) => ({ id: row.id, name: row.name, percent: row.lookDiscountPercent ?? 0, productIds: row.products.map((link) => link.productId) }));
  }

  public async slugTaken(slug: string, exceptId?: string): Promise<boolean> {
    return (await this.prisma.collection.count({ where: { slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) } })) > 0;
  }

  // save => crea o actualiza la colección y, si llegan productIds, REEMPLAZA la lista ordenada (Unit of Work)
  public async save(id: string | null, data: Prisma.CollectionUncheckedCreateInput, productIds?: string[]): Promise<CollectionDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const saved = id
        ? await tx.collection.update({ where: { id }, data, select: { id: true } })
        : await tx.collection.create({ data, select: { id: true } });
      if (productIds) {
        await tx.collectionProduct.deleteMany({ where: { collectionId: saved.id } });
        // "new Set" => elimina duplicados conservando el primer índice (orden estable)
        const unique = [...new Set(productIds)];
        await tx.collectionProduct.createMany({
          data: unique.map((productId, position) => ({ collectionId: saved.id, productId, position })),
        });
      }
      return tx.collection.findUniqueOrThrow({ where: { id: saved.id }, select: COLLECTION_SELECT });
    });
    return toDto(row);
  }

  // softDelete => "eliminar colección sin afectar productos": se borran los vínculos, nunca los productos
  public async softDelete(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.collectionProduct.deleteMany({ where: { collectionId: id } }),
      this.prisma.collection.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, slug: `${id}-deleted` } }),
    ]);
  }
}

function toDto(row: CollectionRow): CollectionDto {
  const { _count, ...rest } = row;
  return { ...rest, productCount: _count.products };
}

export const collectionRepository = new CollectionRepository(prisma);
