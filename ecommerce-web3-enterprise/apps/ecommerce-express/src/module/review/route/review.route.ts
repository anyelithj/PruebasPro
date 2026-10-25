// review.route.ts => lectura pública (optionalAuth para vistas de autor/staff), escritura autenticada.
import { Router } from "express";
import { reviewController } from "../controller/review.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { optionalAuth } from "../../../shared/middleware/jwt.middleware";
import { rateLimit, type RateLimitOptions } from "../../../shared/middleware/rate-limit.middleware";

// Anti-spam: máximo 10 reseñas por hora por IP. Se exporta para que la Mutation GraphQL "createReview" use el
// MISMO bucket (un solo cupo para ambos protocolos: GraphQL no puede usarse para evadir el límite de REST)
export const REVIEW_CREATE_LIMIT: RateLimitOptions = { bucket: "review-create", limit: 10, windowSeconds: 3600 };

export const reviewRouter = Router();

reviewRouter.get("/", optionalAuth, reviewController.listReviews);
reviewRouter.get("/summary", reviewController.summary); // Antes de "/:id"
reviewRouter.get("/photos", reviewController.photos); // RF-15.3 galería (pública)
reviewRouter.get("/:id/revisions", optionalAuth, reviewController.revisions); // RF-15.6
reviewRouter.post("/:id/helpful", jwtAuthGuard, reviewController.toggleHelpful); // RF-15.3
reviewRouter.get("/:id", optionalAuth, reviewController.getReviewById);
reviewRouter.post("/", jwtAuthGuard, rateLimit(REVIEW_CREATE_LIMIT), reviewController.createReview);
reviewRouter.patch("/:id", jwtAuthGuard, reviewController.updateReview);
reviewRouter.delete("/:id", jwtAuthGuard, reviewController.deleteReviewById);
