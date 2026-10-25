// review.controller.ts => capa HTTP del módulo Review.
import type { Request, Response } from "express";
import { reviewService } from "../service/review.service";
import { CreateReviewSchema, ListReviewsQuerySchema, PhotosQuerySchema, SummaryQuerySchema, UpdateReviewSchema } from "../schema/review.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class ReviewController {
  public readonly createReview = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await reviewService.createReview(CreateReviewSchema.parse(req.body), currentUser(req).id), HttpStatus.CREATED);
  });

  public readonly listReviews = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await reviewService.listReviews(ListReviewsQuerySchema.parse(req.query), req.user);
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  // GET /api/v1/review/summary?productId= (promedio y distribución por estrellas)
  public readonly summary = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = SummaryQuerySchema.parse(req.query);
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    sendSuccess(res, await reviewService.summary(productId));
  });

  // RF-15.3 galería y "útil"; RF-15.6 historial
  public readonly photos = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    sendSuccess(res, await reviewService.photos(PhotosQuerySchema.parse(req.query).productId));
  });
  public readonly toggleHelpful = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await reviewService.toggleHelpful(parseId(req), currentUser(req).id));
  });
  public readonly revisions = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await reviewService.revisions(parseId(req), req.user));
  });

  public readonly getReviewById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await reviewService.getReviewById(parseId(req), req.user));
  });

  public readonly updateReview = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await reviewService.updateReview(parseId(req), UpdateReviewSchema.parse(req.body), currentUser(req)));
  });

  public readonly deleteReviewById = asyncHandler(async (req: Request, res: Response) => {
    await reviewService.deleteReviewById(parseId(req), currentUser(req));
    sendNoContent(res);
  });
}

export const reviewController = new ReviewController();
