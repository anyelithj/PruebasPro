// review.service.ts => reseñas con moderación automática (sprint 4.2): compra verificada, sentimiento,
// ventana de edición, moderación del staff, respuesta del vendedor y recálculo del rating del producto.
import { reviewRepository, toDto, type ReviewRepository, type ReviewRow } from "../repository/review.repository";
import { EDIT_WINDOW_DAYS, LexiconSentimentAnalyzer, moderate, REVIEW_REQUEST_DELAY_DAYS, type SentimentAnalyzer } from "../model/review.model";
import type { ReviewRevisionDto } from "../dto/review.dto";
import { notificationService } from "../../notification/service/notification.service";
import type { Prisma } from "@prisma/client";
import { DuplicateReviewException, ReviewEditWindowClosedException, ReviewNotEditableException, ReviewNotFoundException } from "../exception/review.exception";
import type { ReviewDto, ReviewSummaryDto } from "../dto/review.dto";
import type { CreateReviewInput, ListReviewsQuery, UpdateReviewInput } from "../schema/review.schema";
import { productService } from "../../product/service/product.service";
import { commerceEvents } from "../../order/event/order.event";
import { prisma } from "../../../config/database.config";
import { addDays } from "../../../shared/util/date.util";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { Roles } from "../../../shared/constants/roles.constants";
import { NotFoundException } from "../../../shared/filter/http-exception.filter";
import type { ReviewStatus } from "@prisma/client";

interface Viewer {
  id: string;
  roles: string[];
}

export class ReviewService {
  constructor(
    private readonly repository: ReviewRepository,
    private readonly sentiment: SentimentAnalyzer // Puerto inyectado (léxico local hoy, modelo FastAPI mañana)
  ) {}

  // createReview => "publicar reseña con calificación verificada"
  public async createReview(input: CreateReviewInput, userId: string): Promise<ReviewDto> {
    const product = await prisma.product.findFirst({ where: { id: input.productId, status: "ACTIVE" }, select: { id: true } });
    if (!product) throw new NotFoundException("Product", input.productId);
    if (await this.repository.exists(input.productId, userId)) throw new DuplicateReviewException();

    const orderId = await this.repository.findDeliveredOrderWithProduct(userId, input.productId);
    const analysis = this.sentiment.analyze(`${input.title} ${input.body}`); // RF-15.10 puntaje, etiqueta y emociones
    const score = analysis.score;
    const moderation = moderate(`${input.title} ${input.body}`, score);

    const review = await this.repository.create({
      productId: input.productId,
      userId,
      orderId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      sentimentScore: score,
      sentimentLabel: analysis.label,
      emotions: analysis.emotions,
      photoUrls: input.photoUrls,
      ...(input.aspects ? { aspects: input.aspects as Prisma.InputJsonValue } : {}),
      isVerifiedPurchase: orderId !== null,
      status: moderation.status,
      moderationNote: moderation.note,
      editableUntil: addDays(new Date(), EDIT_WINDOW_DAYS),
    });
    if (review.status === "APPROVED") {
      await productService.refreshRating(review.productId);
      this.published(userId, review.id, review.productId, review.photoUrls.length > 0);
    }
    return review;
  }

  // published => RF-14.1 / RF-14.9 la reseña quedó visible: Loyalty da puntos (fotos) y revisa logros
  private published(userId: string, reviewId: string, productId: string, hasPhotos: boolean): void {
    commerceEvents.emit("review.published", { userId, reviewId, productId, hasPhotos });
  }

  // toggleHelpful => RF-15.3 marcar/desmarcar "útil" (no se puede votar la propia reseña)
  public async toggleHelpful(id: string, userId: string): Promise<{ helpful: boolean; helpfulCount: number }> {
    const row = await this.repository.findRaw(id);
    if (!row || row.status !== "APPROVED") throw new ReviewNotFoundException(id);
    if (row.userId === userId) throw new ReviewNotEditableException();
    return this.repository.toggleHelpful(id, userId);
  }

  // photos => RF-15.3 galería de fotos del producto
  public photos(productId: string) {
    return this.repository.photos(productId);
  }

  // revisions => RF-15.6 historial de cambios (visible si la reseña es visible para quien consulta)
  public async revisions(id: string, viewer?: Viewer): Promise<ReviewRevisionDto[]> {
    await this.getReviewById(id, viewer);
    return this.repository.revisions(id);
  }

  // requestReviews => RF-15.8 job: pide la reseña (app + correo + push) 3 días después de la entrega, una vez por pedido
  public async requestReviews(batchSize = 100): Promise<number> {
    const orders = await this.repository.ordersToRequestReview(addDays(new Date(), -REVIEW_REQUEST_DELAY_DAYS), batchSize);
    for (const order of orders) {
      // RF-21.1 también por correo
      await notificationService.notify(order.userId, { type: "REVIEW", message: { key: "reviewRequest", params: { orderNumber: order.orderNumber } }, url: `/account/orders/${order.id}`, channels: ["IN_APP", "EMAIL"] });
      await this.repository.markReviewRequested(order.id);
    }
    return orders.length;
  }

  // listReviews => "listar reseñas con rating y sentimiento" (el público solo ve APPROVED)
  public async listReviews(query: ListReviewsQuery, viewer?: Viewer): Promise<{ items: ReviewDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(
      { productId: query.productId, rating: query.rating, ...this.visibility(query, viewer) },
      query.sort,
      page
    );
    return { items, meta: buildPaginationMeta(page, total) };
  }

  public async summary(productId: string): Promise<ReviewSummaryDto> {
    return this.repository.summary(productId);
  }

  // getReviewById => "reseña con respuesta del vendedor por ID"
  public async getReviewById(id: string, viewer?: Viewer): Promise<ReviewDto> {
    const row = await this.repository.findRaw(id);
    const visible = row && (row.status === "APPROVED" || (viewer && (row.userId === viewer.id || isAdmin(viewer))));
    if (!row || !visible) throw new ReviewNotFoundException(id);
    return toDto(row);
  }

  // updateReview => "editar reseña en período permitido — PATCH parcial" (+ moderación del staff y respuesta del vendedor)
  public async updateReview(id: string, input: UpdateReviewInput, viewer: Viewer): Promise<ReviewDto> {
    const row = await this.repository.findRaw(id);
    if (!row) throw new ReviewNotFoundException(id);
    // Despacho por intención (cada caso con sus propias reglas de autorización => SRP)
    if (input.status !== undefined || input.moderationNote !== undefined) return this.moderateReview(row, input, viewer);
    if (input.vendorReply !== undefined) return this.replyReview(row, input.vendorReply, viewer);
    return this.editReview(row, input, viewer);
  }

  // visibility => qué estados y qué dueño se consultan según quién pregunta
  private visibility(query: ListReviewsQuery, viewer?: Viewer): { statuses: ReviewStatus[]; userId?: string | undefined; vendorId?: string | undefined } {
    if (!viewer) return { statuses: ["APPROVED"] };
    const all: ReviewStatus[] = query.status ? [query.status] : ["APPROVED", "PENDING", "REJECTED"];
    if (query.mine === "true") return { statuses: all, userId: viewer.id };
    if (isAdmin(viewer)) return { statuses: all };
    // Un VENDOR ve todas las reseñas de SUS productos; un cliente, solo las aprobadas
    if (viewer.roles.includes(Roles.VENDOR)) return { statuses: all, vendorId: viewer.id };
    return { statuses: ["APPROVED"] };
  }

  // 1) Moderación: solo admin
  private async moderateReview(row: ReviewRow, input: UpdateReviewInput, viewer: Viewer): Promise<ReviewDto> {
    if (!isAdmin(viewer)) throw new ReviewNotEditableException();
    const updated = await this.repository.update(row.id, {
      ...(input.status ? { status: input.status } : {}),
      ...(input.moderationNote !== undefined ? { moderationNote: input.moderationNote } : {}),
    });
    await productService.refreshRating(row.productId);
    if (input.status) commerceEvents.emit("review.moderated", { userId: row.userId, reviewId: row.id, productId: row.productId, approved: input.status === "APPROVED" });
    if (input.status === "APPROVED" && row.status !== "APPROVED") this.published(row.userId, row.id, row.productId, row.photoUrls.length > 0);
    return updated;
  }

  // 2) Respuesta del vendedor dueño del producto (o admin)
  private async replyReview(row: ReviewRow, vendorReply: string, viewer: Viewer): Promise<ReviewDto> {
    const isProductVendor = viewer.roles.includes(Roles.VENDOR) && row.product.vendorId === viewer.id;
    if (!isProductVendor && !isAdmin(viewer)) throw new ReviewNotEditableException();
    const updated = await this.repository.update(row.id, { vendorReply, vendorRepliedAt: new Date() });
    commerceEvents.emit("review.replied", { userId: row.userId, reviewId: row.id, productId: row.productId });
    return updated;
  }

  // 3) Edición del autor dentro de la ventana; el nuevo texto se vuelve a moderar
  private async editReview(row: ReviewRow, input: UpdateReviewInput, viewer: Viewer): Promise<ReviewDto> {
    if (row.userId !== viewer.id) throw new ReviewNotEditableException();
    if (row.editableUntil < new Date()) throw new ReviewEditWindowClosedException();
    const title = input.title ?? row.title;
    const body = input.body ?? row.body;
    const analysis = this.sentiment.analyze(`${title} ${body}`);
    const score = analysis.score;
    const moderation = moderate(`${title} ${body}`, score);
    await this.repository.saveRevision(row); // RF-15.6 la versión anterior queda en el historial
    const updated = await this.repository.update(row.id, {
      rating: input.rating ?? row.rating,
      title,
      body,
      ...(input.photoUrls ? { photoUrls: input.photoUrls } : {}),
      ...(input.aspects ? { aspects: input.aspects as Prisma.InputJsonValue } : {}),
      sentimentScore: score,
      sentimentLabel: analysis.label,
      emotions: analysis.emotions,
      status: moderation.status,
      moderationNote: moderation.note,
    });
    await productService.refreshRating(row.productId);
    return updated;
  }

  // deleteReviewById => "eliminar o moderar reseña" (autor o admin)
  public async deleteReviewById(id: string, viewer: Viewer): Promise<void> {
    const row = await this.repository.findRaw(id);
    if (!row || (row.userId !== viewer.id && !isAdmin(viewer))) throw new ReviewNotFoundException(id);
    await this.repository.delete(id);
    await productService.refreshRating(row.productId);
  }
}

export const reviewService = new ReviewService(reviewRepository, new LexiconSentimentAnalyzer());
