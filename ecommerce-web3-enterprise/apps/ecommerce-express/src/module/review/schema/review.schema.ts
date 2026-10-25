// review.schema.ts => validación Zod del módulo Review.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

// CreateReviewSchema => POST /api/v1/review ("publicar reseña con calificación verificada")
// RF-15.2 aspectos (calidad, fidelidad a la descripción, talla, relación calidad-precio) de 1 a 5, todos opcionales
const Star = z.number().int().min(1).max(5);
const AspectsSchema = z.object({ quality: Star.optional(), accuracy: Star.optional(), fit: Star.optional(), value: Star.optional() });

export const CreateReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: Star,
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(3000),
  photoUrls: z.array(z.string().url()).max(6).default([]), // RF-15.2 fotos subidas antes a /media/upload (folder=reviews)
  aspects: AspectsSchema.optional(),
});

// UpdateReviewSchema => PATCH /api/v1/review/:id — tres usos según quién edita:
// autor (rating/title/body), staff (status/moderationNote), vendedor (vendorReply)
export const UpdateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().trim().min(3).max(120).optional(),
  body: z.string().trim().min(10).max(3000).optional(),
  photoUrls: z.array(z.string().url()).max(6).optional(),
  aspects: AspectsSchema.optional(),
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]).optional(),
  moderationNote: z.string().trim().max(300).optional(),
  vendorReply: z.string().trim().min(3).max(1500).optional(),
});

// ListReviewsQuerySchema => "listar reseñas con rating y sentimiento"
export const ListReviewsQuerySchema = PaginationQuerySchema.extend({
  productId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]).optional(), // Solo staff
  mine: z.enum(["true", "false"]).optional(), // "Mis reseñas" en el Account hub
  sort: z.enum(["newest", "rating_desc", "rating_asc", "helpful"]).default("newest"),
});

export const SummaryQuerySchema = z.object({ productId: z.string().uuid() });
// PhotosQuerySchema => GET /api/v1/review/photos?productId= (RF-15.3 galería)
export const PhotosQuerySchema = z.object({ productId: z.string().uuid() });

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
export type ListReviewsQuery = z.infer<typeof ListReviewsQuerySchema>;
