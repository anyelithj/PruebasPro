// review.repository.ts => acceso a datos de reseñas.
import type { Prisma, PrismaClient, ReviewStatus } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { ReviewDto, ReviewSummaryDto } from "../dto/review.dto";
import type { ListReviewsQuery } from "../schema/review.schema";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

const REVIEW_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  product: { select: { name: true, vendorId: true } },
  _count: { select: { revisions: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

const ORDER_BY: Record<ListReviewsQuery["sort"], Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  rating_desc: [{ rating: "desc" }, { createdAt: "desc" }],
  rating_asc: [{ rating: "asc" }, { createdAt: "desc" }],
  // RF-15.3 "Más útiles": votos de los compradores, luego compra verificada
  helpful: [{ helpfulCount: "desc" }, { isVerifiedPurchase: "desc" }, { createdAt: "desc" }],
};

export class ReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findMany(
    filter: { productId?: string | undefined; rating?: number | undefined; statuses: ReviewStatus[]; userId?: string | undefined; vendorId?: string | undefined },
    sort: ListReviewsQuery["sort"],
    page: PageParams
  ): Promise<Paginated<ReviewDto>> {
    const where: Prisma.ReviewWhereInput = {
      status: { in: filter.statuses },
      ...(filter.productId ? { productId: filter.productId } : {}),
      ...(filter.rating ? { rating: filter.rating } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.vendorId ? { product: { vendorId: filter.vendorId } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({ where, include: REVIEW_INCLUDE, orderBy: ORDER_BY[sort], skip: page.skip, take: page.limit }),
      this.prisma.review.count({ where }),
    ]);
    return { items: rows.map(toDto), total };
  }

  // findRaw => fila completa (incluye vendorId del producto para validar la respuesta del vendedor)
  public async findRaw(id: string): Promise<ReviewRow | null> {
    return this.prisma.review.findUnique({ where: { id }, include: REVIEW_INCLUDE });
  }

  public async exists(productId: string, userId: string): Promise<boolean> {
    return (await this.prisma.review.count({ where: { productId, userId } })) > 0;
  }

  // findDeliveredOrderWithProduct => compra verificada: un pedido ENTREGADO del usuario que contenga el producto
  public async findDeliveredOrderWithProduct(userId: string, productId: string): Promise<string | null> {
    const order = await this.prisma.order.findFirst({
      where: { userId, status: "DELIVERED", items: { some: { productId } } },
      select: { id: true },
      orderBy: { placedAt: "desc" },
    });
    return order?.id ?? null;
  }

  public async create(data: Prisma.ReviewUncheckedCreateInput): Promise<ReviewDto> {
    return toDto(await this.prisma.review.create({ data, include: REVIEW_INCLUDE }));
  }

  public async update(id: string, data: Prisma.ReviewUncheckedUpdateInput): Promise<ReviewDto> {
    return toDto(await this.prisma.review.update({ where: { id }, data, include: REVIEW_INCLUDE }));
  }

  public async delete(id: string): Promise<void> {
    await this.prisma.review.delete({ where: { id } });
  }

  // toggleHelpful => RF-15.3 un voto por usuario: si ya votó lo retira; actualiza el contador en la misma transacción
  public async toggleHelpful(reviewId: string, userId: string): Promise<{ helpful: boolean; helpfulCount: number }> {
    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.reviewHelpful.deleteMany({ where: { reviewId, userId } });
      if (removed.count === 0) await tx.reviewHelpful.create({ data: { reviewId, userId } });
      const review = await tx.review.update({ where: { id: reviewId }, data: { helpfulCount: { increment: removed.count === 0 ? 1 : -1 } }, select: { helpfulCount: true } });
      return { helpful: removed.count === 0, helpfulCount: review.helpfulCount };
    });
  }

  // photos => RF-15.3 galería: fotos de reseñas aprobadas del producto (las más recientes primero)
  public async photos(productId: string): Promise<Array<{ reviewId: string; url: string; rating: number; author: string }>> {
    const rows = await this.prisma.review.findMany({
      where: { productId, status: "APPROVED", NOT: { photoUrls: { isEmpty: true } } },
      select: { id: true, photoUrls: true, rating: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    return rows.flatMap((row) => row.photoUrls.map((url) => ({ reviewId: row.id, url, rating: row.rating, author: `${row.user.firstName} ${row.user.lastName.charAt(0)}.` })));
  }

  // saveRevision => RF-15.6 guarda la versión ANTERIOR antes de editar
  public async saveRevision(row: Pick<ReviewRow, "id" | "rating" | "title" | "body">): Promise<void> {
    await this.prisma.reviewRevision.create({ data: { reviewId: row.id, rating: row.rating, title: row.title, body: row.body } });
  }

  public revisions(reviewId: string) {
    return this.prisma.reviewRevision.findMany({ where: { reviewId }, orderBy: { editedAt: "desc" }, select: { rating: true, title: true, body: true, editedAt: true } });
  }

  // ordersToRequestReview => RF-15.8 pedidos entregados hace N días a los que aún no se les pidió reseña
  public ordersToRequestReview(before: Date, limit: number) {
    return this.prisma.order.findMany({
      where: { status: "DELIVERED", reviewRequestedAt: null, shipment: { deliveredAt: { lte: before } } },
      select: { id: true, orderNumber: true, userId: true },
      take: limit,
    });
  }

  public async markReviewRequested(orderId: string): Promise<void> {
    await this.prisma.order.update({ where: { id: orderId }, data: { reviewRequestedAt: new Date() } });
  }

  // summary => distribución 1..5 de reseñas aprobadas con un groupBy (una consulta)
  public async summary(productId: string): Promise<ReviewSummaryDto> {
    const [groups, aspectRows] = await Promise.all([
      this.prisma.review.groupBy({ by: ["rating"], where: { productId, status: "APPROVED" }, _count: { _all: true } }),
      this.prisma.review.findMany({ where: { productId, status: "APPROVED" }, select: { aspects: true, photoUrls: true } }),
    ]);
    const distribution: ReviewSummaryDto["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let count = 0;
    let sum = 0;
    for (const group of groups) {
      const rating = group.rating as 1 | 2 | 3 | 4 | 5; // El CHECK de la base garantiza 1..5
      distribution[rating] = group._count._all;
      count += group._count._all;
      sum += group.rating * group._count._all;
    }
    // RF-15.2 promedio por aspecto (solo reseñas que lo calificaron)
    const totals = new Map<string, { sum: number; n: number }>();
    for (const row of aspectRows) {
      for (const [key, value] of Object.entries((row.aspects as Record<string, number> | null) ?? {})) {
        const entry = totals.get(key) ?? { sum: 0, n: 0 };
        totals.set(key, { sum: entry.sum + value, n: entry.n + 1 });
      }
    }
    const aspects = Object.fromEntries([...totals].map(([key, entry]) => [key, Number((entry.sum / entry.n).toFixed(2))]));
    const photoCount = aspectRows.reduce((total, row) => total + row.photoUrls.length, 0);
    return { productId, average: count === 0 ? 0 : Number((sum / count).toFixed(2)), count, distribution, aspects, photoCount };
  }
}

// toDto => nombre del autor abreviado ("Ana M."): privacidad en contenido público
export function toDto(row: ReviewRow): ReviewDto {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    author: { id: row.user.id, name: `${row.user.firstName} ${row.user.lastName.charAt(0)}.`.trim(), avatarUrl: row.user.avatarUrl },
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    sentimentScore: row.sentimentScore,
    isVerifiedPurchase: row.isVerifiedPurchase,
    vendorReply: row.vendorReply,
    vendorRepliedAt: row.vendorRepliedAt,
    editableUntil: row.editableUntil,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    photoUrls: row.photoUrls,
    aspects: (row.aspects as ReviewDto["aspects"]) ?? null,
    helpfulCount: row.helpfulCount,
    sentimentLabel: row.sentimentLabel,
    emotions: (row.emotions as Record<string, number> | null) ?? null,
    edited: row._count.revisions > 0,
  };
}

export const reviewRepository = new ReviewRepository(prisma);
